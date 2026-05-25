import type * as psp from '@perspective-dev/client';
import { perspectiveClient } from "$lib/perspective/libraryManager";
import { SvelteMap } from 'svelte/reactivity';
import { untrack } from 'svelte';


const DEFAULT_OPTIONS: Partial<DFOptions> = {} //{ index: 'id' };
export type MaybePromise<T> = T | Promise<T>;
export type DFOptions = psp.TableInitOptions;
export type DataFrame = psp.Table;
export type DataFrameInputs = MaybePromise<Response | ArrayBuffer>
export type DataFrameLoader = () => DataFrameInputs;
export type DataFrameSource = DataFrameInputs | DataFrameLoader;
type BufferProps = Omit<ConstructorProps, 'data' | 'dataFrame'> & { data: ArrayBuffer };
type APIProps = Omit<ConstructorProps, 'data'> & { data: Response };

export interface ConstructorProps {
    name: string
    options?: DFOptions;
    data: DataFrameInputs;
    sourceUrl?: string;
}
export interface IDataFrameProxyV3 extends DataFrame {
    name: string;
    sourceUrl?: string;
    createView: (
        additionalConfig?: Partial<psp.ViewConfigUpdate>,
        overrideBaseFiltering?: boolean,
    ) => Promise<psp.View>;
}

const isLoader = (value: DataFrameSource): value is DataFrameLoader => typeof value === 'function';
const isBuffer = (v: unknown): v is ArrayBuffer => v instanceof ArrayBuffer;
const isResponse = (v: unknown): v is Response => v instanceof Response;

export class DataFrameProxyV3 {
    readonly name: string;
    private dataFrame: DataFrame;
    dataVersion = 0;

    readonly sourceUrl?: string;


    private constructor(obj: Omit<ConstructorProps, 'dataFrame'> & { dataFrame: DataFrame }) {
        this.name = obj.name;
        this.dataFrame = obj.dataFrame;
        this.sourceUrl = obj.sourceUrl;
    }

    static async create(props: ConstructorProps): Promise<IDataFrameProxyV3> {
        if (!props.options) {
            props.options = DEFAULT_OPTIONS;
        }

        const resolved = await this.resolveSource(props.data);
        if (isBuffer(resolved)) return DataFrameProxyV3.createFromBuffer({ ...props, data: resolved });
        if (isResponse(resolved)) return DataFrameProxyV3.createFromAPI({ ...props, data: resolved });
        throw new Error('Unrecognized data type');
    }

    private static async resolveSource(source: DataFrameSource): Promise<Response | ArrayBuffer> {
        return Promise.resolve(isLoader(source) ? source() : source);
    }

    private static async createFromAPI({ data, name, options, sourceUrl }: APIProps): Promise<IDataFrameProxyV3> {
        try {
            const buffer = await data.arrayBuffer();
            return this.createFromBuffer({ data: buffer, name, options, sourceUrl });
        } catch (error) {
            console.error('Error creating DataFrame from API:', error);
            throw error;
        }
    }
    private static async createFromBuffer({ data, name, options, sourceUrl }: BufferProps): Promise<IDataFrameProxyV3> {
        try {
            let dataFrame: DataFrame;
            let effectiveOptions = options;
            dataFrame = await perspectiveClient.table(data, options);

            const proxy = new DataFrameProxyV3({ dataFrame, name, options: effectiveOptions, data, sourceUrl });
            // Proxy che forwarda tutto a `dataFrame`, ma usa anche metodi di `DataFrameProxyV3`
            return this.createProxy(proxy);
        } catch (error) {
            console.error('Errorz creating DataFrame from buffer:', error);
            throw error;
        }
    }


    private static createProxy(proxy: DataFrameProxyV3) {
        // Proxy che forwarda tutto a `dataFrame`, ma usa anche metodi di `DataFrameProxyV3`
        return new Proxy(proxy, {
            get(target, prop, _receiver) {
                if (prop in target) {
                    return Reflect.get(target, prop, target);
                }
                const dataFrameProp = (target.dataFrame as any)[prop];
                if (typeof dataFrameProp === 'function') {
                    return dataFrameProp.bind(target.dataFrame);
                }
                return dataFrameProp;
            },
            set(target, prop, value) {
                return Reflect.set(target, prop, value, target);
            },
        }) as unknown as IDataFrameProxyV3;
    }

    async createView(config: Partial<psp.ViewConfigUpdate> = {}) {
        const view = await this.dataFrame.view(config);
        //return { view, viewConfig: fullConfig }; -> OLD WAY USELESS BECAUSE WE HAVE view.get_config
        return view;
    }

    // Getter per accedere al DataFrame originale se necessario
    get originalDataFrame(): DataFrame {
        return this.dataFrame;
    }

    // Metodo per informazioni di debug
    getProxyInfo() {
        return {
            name: this.name,
            dataVersion: this.dataVersion,
            dataFrame: this.dataFrame,
        };
    }

}

export function createDataFrameStore3(props: ConstructorProps) {
    return DataFrameProxyV3.create(props);
}
export function getDataFrameStore3(name: string) {
    return tableRegistry3.get(name)!;
}

export function getOrCreateDataFrameStore3(props: ConstructorProps) {
    if (!tableRegistry3.has(props.name)) {
        const df = createDataFrameStore3(props);
        untrack(() => {
            tableRegistry3.set(props.name, df);
        });
    }
    return getDataFrameStore3(props.name);
}

const tableRegistry3 = new SvelteMap<string, Promise<IDataFrameProxyV3>>();