import { Worker } from "worker_threads";
import { EventEmitter } from "events";

export class WorkerInstance extends EventEmitter {
    private worker: Worker;
    private isDone: boolean = false;

    public constructor(data: any) {
        super();
        this.worker = new Worker(__dirname +  "/worker.js", {workerData: data});

        this.worker.on("message", data => {
            this.handleMessage(data);
        })

        this.worker.on("error", err => {
            this.emit("error", err)
            this.emit("*", { name: "error", data: err })
        })

        this.worker.on("exit", (statusCode) => {
            this.isDone = true;
            this.emit("exit", statusCode)
            this.emit("*", { name: "exit", data: statusCode })
        })
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.once("*", (data) => {
                if(data.name === "initialized") {
                    resolve();
                } else {
                    reject(data);
                }
            })

            this.worker.postMessage({ action: "initialize" });
        })
    }

    public start(data?: any): Promise<void> {
        return new Promise((resolve, reject) => {
            this.once("*", (data) => {
                if(data.name === "started") {
                    resolve();
                } else {
                    reject(data);
                }
            })

            this.worker.postMessage({ action: "start", data: data });
        })
    }

    public sync(data: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this.isDone) {
                resolve();
            }

            this.once("*", (data) => {
                if (data.name === "synchronized") {
                    resolve(data.data);
                } else if (data.name === "exit") {
                    resolve();
                } else {
                    reject(data);
                }
            });

            this.worker.postMessage({
                action: "sync",
                data: data
            })
        })
    }

    public async terminate() {
        await this.worker.terminate()
    }

    private handleMessage(data) {

        // console.log("MESSAGE", data);
        // Actions: initialized, data, count, started, synced, exit, error
        this.emit(data.action, data.data);
        if (data.action !== "count") {
            this.emit("*", { name: data.action, data: data.data })
        }
    }
}
