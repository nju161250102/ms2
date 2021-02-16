import { EventEmitter } from "events"
import { spawn} from "child_process";
import { config } from "./config";
import { ncp } from "ncp";
import * as fs from "fs";
import * as recorder from "./recorder";
import * as moment from "moment";

class MinecraftProcess extends EventEmitter {
  private runningFlag = false;
  private mcp;
  private currentCommand: string = null;
  private returnMap: Map<string, RegExp> = new Map();

  constructor() {
    super();
    this.mcp = this.startMinecraftServer();
    // 添加可执行命令以及能匹配结果的正则表达式
    this.returnMap.set("fill", new RegExp("filled"))
  }

  /**
   * 向命令行中输入mc操作命令，控制命令（例如stop）不要使用此方法
   * @param command
   */
  runCommand(command: string) {
    let commandType = command.split(" ")[0];
    if (this.currentCommand == null && this.returnMap.has(commandType)) {
      this.currentCommand = commandType;
      this.mcp.stdin.write(command + "\n");
      return true;
    }
    return false;
  }

  getStatus() {
    return this.runningFlag;
  }

  restart() {
    this.mcp = this.startMinecraftServer();
  }

  backup() {
    return new Promise<string>((resolve, reject) => {
      console.log("backup...");
      this.mcp.on("close", () => {
        const datePostfix = moment(new Date()).format("YYYY-MM-DD HH:mm:ss").replace(":", "-");
        const backupName = `${config.mc.levelName}-${datePostfix}`;
        ncp(
          `${config.mc.worlds}${config.mc.levelName}`,
          `${config.mc.worlds}${backupName}`,
          (error) => {
            if (error) {
              console.log(`backup error:${error}`);
              reject(`${error}`);
            } else {
              console.log("backup success.");
              this.restart();
              resolve(backupName);
            }
          }
        );
      });
      this.mcp.stdin.write("stop\n");
    });
  }

  rollback(backupName: string) {
    return new Promise<void>((resolve, reject) => {
      if (fs.readdirSync(`${config.mc.worlds}`).includes(backupName)) {
        mcProcess.on("close", () => {
          //save current game
          ncp(
            `${config.mc.worlds}${config.mc.levelName}`,
            `${config.mc.worlds}${config.mc.levelName}.old`,
            (error) => {
              if (error) {
                console.log(`error while rollback:${error}`);
                reject(error);
              } else {
                //remove old game
                fs.rmSync(`${config.mc.worlds}${config.mc.levelName}`, {
                  recursive: true,
                });
                //copy backup version
                ncp(
                  `${config.mc.worlds}${backupName}`,
                  `${config.mc.worlds}${config.mc.levelName}`,
                  (error) => {
                    if (error) {
                      console.log(`rollback error:${error}`);
                      reject(error);
                    } else {
                      console.log("rollback success.");
                      this.restart();
                      resolve();
                    }
                  }
                );
              }
            }
          );
        });
        this.mcp.stdin.write("stop\n");
      }
    });
  }

  private startMinecraftServer() {
    console.log("starting minecraft server...");
    const _mcp = spawn(config.mc.path, {
      detached: true,
    });

    _mcp.stdout.on("data", (data: Buffer) => {
      // 先判断是否出现语法错误
      if (this.currentCommand && data.toString().search("error")) {
        this.emit("commandError", data.toString());
      }
      // 再判断是否为命令运行结束
      else if (this.currentCommand && this.returnMap.get(this.currentCommand).test(data.toString())) {
        this.emit("commandSuccess", data.toString());
      }
      recorder.append(data.toString(), recorder.DataType.STDOUT);
    });

    _mcp.stderr.on("data", (data: Buffer) => {
      recorder.append(data.toString(), recorder.DataType.STDERR);
    });

    _mcp.on("exit", () => {
      console.log("exit");
      this.runningFlag = false;
    });

    _mcp.on("close", () => {
      console.log("close");
      this.runningFlag = false;
    });

    _mcp.on("error", (e) => {
      console.log("error", e);
      this.runningFlag = false;
    });

    console.log("minecraft server started");
    this.runningFlag = true;

    //listen Ctrl-C
    process.on("SIGINT", () => {
      console.log("stopping mc server...");
      _mcp.on("exit", () => {
        console.log("mc server stopped.");
        process.exit(0);
      });
      _mcp.stdin.write("stop\n");
    });
    return _mcp;
  }

}
let mcProcess = new MinecraftProcess();

//----------------------------------------------------------------------------------------------------------------------

export const runCommand = (data: string) =>
  new Promise((resolve, reject) => {
    if (mcProcess.runCommand(data)) {
      mcProcess.once("commandSuccess", () => {
        resolve(true);
      });
      mcProcess.once("commandError", () => {
        resolve(false);
      });
    } else {
      resolve(false);
    }
  });

export const backup = () => mcProcess.backup();

export const getBackupList = () => {
  return fs.readdirSync(`${config.mc.worlds}`);
};

export const rollback = (backupName: string) => mcProcess.rollback(backupName);

// 检查服务器运行状态
export const checkStatus = () => {
  return mcProcess.getStatus();
}

// 重启服务器
// 设置force参数可以强制重启
export const restartServer = (force = false) =>
  new Promise<void>((resolve, reject) => {
    if (force || ! mcProcess.getStatus()) {
      mcProcess.restart();
      if (mcProcess.getStatus()) {
        resolve();
      } else {
        reject("Server restart failed!");
      }
    } else {
      reject("Server doesn't need to restart");
    }
  });
