import Table from "cli-table3";
import pm2 from "pm2";
import prettyBytes from "pretty-bytes";
import prettyMs from "pretty-ms";
import { Tail } from "tail";

function createConnection(callback) {
    pm2.connect(connectionError => {
        if (connectionError) {
            console.error(connectionError);
            process.exit(2);
        }

        callback();
    });
}

export function start(options: any) {
    createConnection(() => {
        pm2.start(
            {
                ...{
                    max_restarts: 5,
                    min_uptime: "5m",
                    kill_timeout: 30000,
                },
                ...options,
            },
            startError => {
                pm2.disconnect();

                if (startError) {
                    throw startError;
                }
            },
        );
    });
}

export function stop(processName: string) {
    createConnection(() => {
        pm2.stop(processName, stopError => {
            pm2.disconnect();

            if (stopError) {
                throw stopError;
            }
        });
    });
}

export function restart(processName: string) {
    createConnection(() => {
        pm2.reload(processName, reloadError => {
            pm2.disconnect();

            if (reloadError) {
                throw reloadError;
            }
        });
    });
}

export function shutdown(processName: string) {
    createConnection(() => {
        pm2.delete(processName, deleteError => {
            pm2.disconnect();

            if (deleteError) {
                throw deleteError;
            }
        });
    });
}

export function destroy(processName: string) {
    createConnection(() => {
        pm2.delete(processName, deleteError => {
            pm2.disconnect();

            if (deleteError) {
                throw deleteError;
            }
        });
    });
}

export function list(token: string) {
    createConnection(() => {
        pm2.list((listError, processDescriptionList) => {
            pm2.disconnect();

            if (listError) {
                throw listError;
            }

            const table = new Table({
                head: ["ID", "Name", "Version", "Status", "Uptime", "CPU %", "Mem %"],
                chars: { mid: "", "left-mid": "", "mid-mid": "", "right-mid": "" },
            });

            const processList = Object.values(processDescriptionList).filter(p => p.name.startsWith(token));

            for (const process of processList) {
                // @ts-ignore
                table.push([
                    process.pid,
                    process.name,
                    // @ts-ignore
                    process.pm2_env.version,
                    process.pm2_env.status,
                    process.pm2_env.pm_uptime,
                    process.monit.cpu,
                    prettyBytes(process.monit.memory),
                ]);
            }

            console.log(table.toString());
        });
    });
}

export function log(processName: string, onlyErrors: boolean) {
    createConnection(() => {
        pm2.describe(processName, (deleteError, apps) => {
            pm2.disconnect();

            if (deleteError) {
                throw deleteError;
            }

            if (!apps[0]) {
                console.log(`The "${processName}" process is not running, thus no logs are to be viewed.`);
                process.exit();
            }

            const app = apps[0].pm2_env;

            const log = new Tail(onlyErrors ? app.pm_err_log_path : app.pm_out_log_path);
            log.on("line", data => console.log(data));
            log.on("error", error => console.error("ERROR: ", error));
        });
    });
}
