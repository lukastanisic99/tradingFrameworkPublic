import crypto from 'crypto';
import axios from 'axios';
import { AxiosResponse } from 'axios';

export interface RequestConfig {
    timeout?: number;
    proxy?: any;
    httpsAgent?: any;
}

class Request {
    public static signRequest(method: string, baseURL: string, path: string, apiKey: string, apiSecret: string, params = {}, config: RequestConfig = {}): Promise<AxiosResponse<any, any>> {
        params = Request.removeEmptyValue(params);
        const queryString = Request.buildQueryString(params);
        const signature = crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');

        return Request.createRequest({
            method,
            baseURL: baseURL,
            url: `${path}?${queryString}&signature=${signature}`,
            apiKey: apiKey,
            timeout: config.timeout ? config.timeout : 0,
            proxy: config.proxy,
            httpsAgent: config.httpsAgent,
        });
    }

    private static removeEmptyValue = (obj: Object): Object => {
        if (!(obj instanceof Object)) return {};
        Object.keys(obj).forEach((key) => Request.isEmptyValue(obj[key]) && delete obj[key]);
        return obj;
    };

    private static isEmptyValue = (input): boolean => {
        /**
         * Scope of empty value: falsy value (except for false and 0),
         * string with white space characters only, empty object, empty array
         */
        return (
            (!input && input !== false && input !== 0) ||
            (typeof input === 'string' && /^\s+$/.test(input)) ||
            (input instanceof String && /^\s+$/.test(input.toString())) ||
            (input instanceof Object && !Object.keys(input).length) ||
            (Array.isArray(input) && !input.length)
        );
    };

    private static buildQueryString = (params): string => {
        if (!params) return '';
        return Object.entries(params).map(Request.stringifyKeyValuePair).join('&');
    };

    private static stringifyKeyValuePair = ([key, value]) => {
        const valueString = Array.isArray(value) ? `["${value.join('","')}"]` : value;
        return `${key}=${encodeURIComponent(valueString)}`;
    };

    private static createRequest = (config): Promise<AxiosResponse<any, any>> => {
        const { baseURL, apiKey, method, url, timeout, proxy, httpsAgent } = config;
        return Request.getRequestInstance({
            baseURL,
            timeout,
            proxy,
            httpsAgent,
            headers: {
                'Content-Type': 'application/json',
                'X-MBX-APIKEY': apiKey,
                // 'User-Agent': `${constants.appName}/${constants.appVersion}`,
            },
        }).request({
            method,
            url,
        });
    };

    private static getRequestInstance = (config) => {
        return axios.create({
            ...config,
        });
    };
}

export default Request;
