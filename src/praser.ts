import * as recorder from "./recorder";
import {DataType} from "./recorder";
import {parseCommand} from "./command/commandMap";
import {runCommand} from './mcProcess'

/**
 * 解析命令并送入执行队列
 * @param command 网页控制台输入的命令
 */
export const commandHandle = async (command: string) => {
  let commandList: string[] = parseCommand(command);
  if (! (commandList.length == 1 && command === commandList[0])) {
    recorder.append(command, DataType.USERIN)
  }
  for (let c in commandList) {
    let result = await runCommand(c);
    if (! result) {
      recorder.append("Failed: " + command, DataType.USERERROR);
      return;
    }
  }
  recorder.append("Success: " + command, DataType.USEROUT);
}