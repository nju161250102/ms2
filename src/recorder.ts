/**
 * 记录与mc服务器的往返消息并用于前端展示
 */
import * as moment from "moment"

export enum DataType {
  STDIN = "stdin",
  STDOUT = "stdout",
  STDERR = "stderr",
  USERIN = "userIn",
  USEROUT = "userOut",
  USERERROR = "userError",
}

type DataItem = {
  index: number;
  type: DataType;
  data: string;
  time: Date;
};

let index = 0;
const dataItems: DataItem[] = [];

/**
 * 新增一条消息记录
 * @param data 记录内容
 * @param type 消息类型
 * @param time 时间，默认值为当前时间
 */
export const append = (data: string, type: DataType, time = new Date()) => {
  dataItems.push({
    index,
    data,
    type,
    time: time,
  });
  index++;
  //log
  console.log(
    `[${moment(time).format("YYYY-MM-DD HH:mm:ss")}][${type}] ${data.replace(
      /\r?\n/g,
      "\\n"
    )}`
  );
  //limit to 128 item
  if (dataItems.length > 128) {
    dataItems.shift();
  }
}

/**
 * 获取消息
 * @param type 可选，用于根据消息类型筛选结果
 * @return DataItem[]
 */
export const getData = (type?: DataType) => {
  if (type) {
    return dataItems.filter((value) => value.type === type);
  } else {
    return dataItems;
  }
}
