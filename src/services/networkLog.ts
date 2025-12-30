export interface NetworkRequest {
    id: string;
    method: string;
    url: string;
    startTime: number;
    endTime?: number;
    status?: number;
    statusText?: string;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    responseBodyPreview?: string;
    duration?: number;
    error?: string;
}

const MAX_LOGS = 50;

export const NetworkLogService = {
    logs: [] as NetworkRequest[],
    listeners: new Set<() => void>(),

    logRequest(method: string, url: string, headers?: Record<string, string>): string {
        const id = Math.random().toString(36).substring(7);
        const req: NetworkRequest = {
            id,
            method,
            url,
            startTime: Date.now(),
            requestHeaders: headers
        };

        this.logs.unshift(req);
        if (this.logs.length > MAX_LOGS) {
            this.logs = this.logs.slice(0, MAX_LOGS);
        }
        this.notify();
        return id;
    },

    logResponse(id: string, status: number, statusText: string, headers?: Record<string, string>, bodyPreview?: string) {
        const req = this.logs.find(r => r.id === id);
        if (req) {
            req.endTime = Date.now();
            req.duration = req.endTime - req.startTime;
            req.status = status;
            req.statusText = statusText;
            req.responseHeaders = headers;
            req.responseBodyPreview = bodyPreview;
            this.notify();
        }
    },

    logError(id: string, error: string) {
        const req = this.logs.find(r => r.id === id);
        if (req) {
            req.endTime = Date.now();
            req.duration = req.endTime - req.startTime;
            req.error = error;
            req.status = 0;
            this.notify();
        }
    },

    getLogs() {
        return [...this.logs];
    },

    clear() {
        this.logs = [];
        this.notify();
    },

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    },

    notify() {
        this.listeners.forEach(l => l());
    }
};
