import { IHttpResponse } from '@/api/http';
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { gotoLogin } from '@/utils/common';

export const defaultResponse = {
  code: 0,
  msg: '未知错误',
  data: {},
};

export const defaultOkMock = {
  code: 200,
  data: '',
  msg: '操作成功（这是一个 mock 数据）',
};
export function adminResponse(response: AxiosResponse) {
  const msg = response.data
    ? response.data.msg || response.data.message || response.data.error
    : '';
  return {
    code: response.status,
    data: response.data,
    msg,
  };
}
export const commonResponse = adminResponse;
export class CommonErrorRespond {
  public data: IHttpResponse = defaultResponse;
  constructor(error: AxiosError) {
    if (!error.response) {
      return;
    }
    const code = error.response.status;
    const message = error.message;
    const data = error.response.data || {};
    if (code >= 500) {
      this.data = {
        code,
        data: {},
        msg: data.msg || '服务器内部错误',
      };
      return;
    }
    if (code >= 400) {
      this.data = {
        code,
        data: {},
        msg: data.msg || '请求地址无效或无权限',
      };
      return;
    }
    this.data = {
      code,
      data: {},
      msg: `其他错误: ${message}(${code})`,
    };
  }
}

export function buildParams(
  url: string,
  query: { [key: string]: string | number },
) {
  for (const key in query) {
    if (query.hasOwnProperty(key)) {
      url = url.replace(new RegExp(`:${key}`, 'g'), String(query[key]));
    }
  }
  return url;
}

axios.defaults.baseURL = '/';
// 创建一个拦截器，当 axios 同时请求重复 api 的时，终止请求
const pending: {
  [key: string]: any;
} = {};
const CancelToken = axios.CancelToken;
const removePending = (key: string, isRequest = false) => {
  if (pending[key] && isRequest) {
    pending[key]('取消重复请求');
  }
  delete pending[key];
};
const getRequestIdentify = (config: AxiosRequestConfig, isRequest = false) => {
  let url = config.url;
  if (isRequest) {
    if (config.url) {
      url = config.baseURL + config.url.substring(1, config.url.length);
    }
  }
  return config.method === 'get'
    ? encodeURIComponent(url + JSON.stringify(config.params))
    : encodeURIComponent(config.url + JSON.stringify(config.data));
};
axios.interceptors.request.use(
  (config) => {
    const requestData = getRequestIdentify(config, true);
    removePending(requestData, true);

    config.cancelToken = new CancelToken((c) => {
      pending[requestData] = c;
    });

    return config;
  },
  (error) => {
    // 强制处理成固定的 error 格式，这样可以在 await 下不实用 try catch 来捕获错误
    return Promise.resolve(new CommonErrorRespond(error));
  },
);

axios.interceptors.response.use(
  (data) => {
    if (/未登录/.test(String(data?.data?.msg))) {
      gotoLogin();
    }
    return data;
  },
  (error: AxiosError) => {
    const msg = error?.response?.data?.msg;
    if (/未登录/.test(String(msg))) {
      gotoLogin();
    }
    return Promise.resolve(new CommonErrorRespond(error));
  },
);
