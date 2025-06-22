import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Define types based on user's request
interface RunOptions {
  executionMode: 'sequential' | 'parallel';
  delayBetweenRequests?: number;
  environment: 'development' | 'staging' | 'production';
  variables: Record<string, any>;
}

interface RequestData {
  id: number;
  name: string;
  method: string;
  url: string;
  headers?: Record<string, any>;
  body?: Record<string, any>;
  params?: Record<string, any>;
}

interface RequestResult {
  requestId: number;
  name: string;
  method: string;
  url: string;
  status: 'completed' | 'failed';
  response?: {
    status: number;
    statusText: string;
    data: any;
    headers: any;
  };
  error?: string;
  duration: number;
  timestamp: string;
}

interface RunSummary {
  total: number;
  completed: number;
  failed: number;
  totalDuration: number;
}

interface RunOutput {
  runId: string;
  status: 'running' | 'completed' | 'failed';
  results: RequestResult[];
  summary: RunSummary;
}

// Function to replace variables like {{variableName}}
const replaceVariables = (str: string, variables: Record<string, any>): string => {
  if (!str) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
    return variables[variableName] || match;
  });
};

const executeRequest = async (request: RequestData, variables: Record<string, any>): Promise<RequestResult> => {
    const startTime = Date.now();
    const result: Partial<RequestResult> = {
      requestId: request.id,
      name: request.name,
      method: request.method,
      url: replaceVariables(request.url, variables),
      timestamp: new Date().toISOString(),
    };
  
    try {
      const config: AxiosRequestConfig = {
        method: request.method as Method,
        url: result.url,
        headers: request.headers ? JSON.parse(replaceVariables(JSON.stringify(request.headers), variables)) : undefined,
        data: request.body ? JSON.parse(replaceVariables(JSON.stringify(request.body), variables)) : undefined,
        params: request.params ? JSON.parse(replaceVariables(JSON.stringify(request.params), variables)) : undefined,
        validateStatus: () => true, // Always resolve, even for non-2xx statuses
      };
  
      const response: AxiosResponse = await axios(config);
  
      result.status = 'completed';
      result.response = {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers,
      };
  
    } catch (error: any) {
      result.status = 'failed';
      result.error = error.message;
    }
  
    result.duration = Date.now() - startTime;
    return result as RequestResult;
  };

export const runCollection = async (requests: RequestData[], options: RunOptions): Promise<RunOutput> => {
    const runId = uuidv4();
    const results: RequestResult[] = [];
    let totalDuration = 0;
  
    const runStartTime = Date.now();
  
    if (options.executionMode === 'sequential') {
      for (const request of requests) {
        const result = await executeRequest(request, options.variables);
        results.push(result);
        if (options.delayBetweenRequests) {
          await new Promise(resolve => setTimeout(resolve, options.delayBetweenRequests));
        }
      }
    } else {
      const promises = requests.map(request => executeRequest(request, options.variables));
      const settledResults = await Promise.all(promises);
      results.push(...settledResults);
    }
  
    totalDuration = Date.now() - runStartTime;
  
    const summary: RunSummary = {
      total: requests.length,
      completed: results.filter(r => r.status === 'completed').length,
      failed: results.filter(r => r.status === 'failed').length,
      totalDuration: totalDuration,
    };
  
    return {
      runId,
      status: summary.failed > 0 ? 'failed' : 'completed',
      results,
      summary,
    };
  }; 