'use strict';
/**
 * @author IITII
 * @date 2020/8/28 11:39
 */
const got = require('got'),
  _ = require('lodash'),
  async = require('async'),
  date = new Date(),
  // User name
  NAME = process.env.HWC_NAME,
  // User password
  PASSWORD = process.env.HWC_PASSWORD,
  // User domain name
  USER_DOMAIN_NAME = process.env.HWC_USER_DOMAIN_NAME,
  // User scope domain name
  SCOPE_DOMAIN_NAME = process.env.HWC_SCOPE_DOMAIN_NAME,
  // SCOPE_PROJECT_NAME = process.env.SCOPE_PROJECT_NAME,
  // See: https://apiexplorer.developer.huaweicloud.com/apiexplorer/doc?product=IAM&api=KeystoneCreateUserTokenByPassword
  // See: https://apiexplorer.developer.huaweicloud.com/apiexplorer/doc?product=CDN&api=CreatePreheatingTasks

  // Anything about api url?
  // See: https://github.com/sindresorhus/ky/issues/70
  API = {
    IAM: {
      END_POINT: 'https://iam.cn-north-4.myhuaweicloud.com',
      KeystoneCreateUserTokenByPassword: 'v3/auth/tokens'
    },
    CDN: {
      END_POINT: 'https://cdn.myhwclouds.com',
      preheatingtasks: 'v1.0/cdn/preheatingtasks',
      refreshtasks: 'v1.0/cdn/refreshtasks',
      ShowHistoryTaskDetails: 'v1.0/cdn/historytasks/history_tasks_id/detail',
    }
  };

/**
 * sleep for a while
 * @param ms ms
 */
async function sleep(ms) {
  return await new Promise((resolve) => {
    setTimeout(() => {
      return resolve();
    }, ms)
  })
}

/**
 * get previous break traffic state, only support linux
 * @param INTERFACE_NAME network interface device name
 * @return unit: byte, previous break traffic state
 */
function get_bytes(INTERFACE_NAME = 'eth0') {
  const {spawnSync} = require('child_process'),
    os = require('os');
  let NET_FILE = '/proc/net/dev';
  if (os.networkInterfaces()[INTERFACE_NAME] === undefined) {
    throw new Error('No such interface!!!');
  }
  if (os.platform() !== 'linux') {
    throw new Error('Unsupported platform!!!');
  }
  const op = {
    "shell": true,
    "windowsHide": true
  }
  let result = spawnSync(
    `cat ${NET_FILE} | grep ${INTERFACE_NAME}  | awk '{print $2 " " $10}'`,
    op
  );
  if (result.status !== 0) {
    console.error(result.error);
    return [];
  }
  let bytes = result.stdout.toString().split(new RegExp('\\s+'));
  return {
    RX: bytes[0],
    TX: bytes[1]
  }
}

/**
 * Get live network speed
 * @param INTERFACE_NAME Interface name
 * @param sampling_break Sampling break
 * @param human Show human readable net speed
 */
async function live_net_speed(INTERFACE_NAME = 'eth0', sampling_break = 1000, human = false) {
  let pre = get_bytes(INTERFACE_NAME);
  await sleep(sampling_break);
  let current = get_bytes(INTERFACE_NAME);
  return (() => {
    let TX_S = (current.TX - pre.TX) / sampling_break * 1000;
    let RX_S = (current.RX - pre.RX) / sampling_break * 1000;
    return {
      TX: {
        human: human ? human_net_speed(TX_S) : '',
        raw: TX_S
      },
      RX: {
        human: human ? human_net_speed(RX_S) : '',
        raw: RX_S
      }
    }
  })();
}

/**
 * Get human readable network speed
 * @param bytes bytes
 * @param pre_unit {number} 1024 or 1000, default 1024
 * @param bits Keep decimal places, default 1
 * @return {string} human readable network speed
 */
function human_net_speed(bytes, pre_unit = 1024, bits = 1) {
  const kb = pre_unit,
    mb = kb * pre_unit,
    gb = mb * pre_unit,
    tb = gb * pre_unit,
    pb = tb * pre_unit;
  console.log(pb)
  if (bytes > gb) {
    if (bytes > tb) {
      if (bytes > pb) {
        return `${(bytes / pb).toFixed(bits)} PB/s`
      } else {
        return `${(bytes / tb).toFixed(bits)} TB/s`
      }
    } else {
      return `${(bytes / gb).toFixed(bits)} GB/s`
    }
  } else {
    if (bytes > mb) {
      return `${(bytes / mb).toFixed(bits)} MB/s`
    } else {
      if (bytes > kb) {
        return `${(bytes / kb).toFixed(bits)} KB/s`
      } else {
        return `${(bytes).toFixed(bits)} B/s`
      }
    }
  }
}

/**
 * Wait for low traffic usage
 * @param INTERFACE interface name, default eth0
 * @param break_time query break,unit: millisecond, default 5000
 * @param TX_RX 'TX' | 'RX' | 'TR', listening on TX or RX or TX & RX traffic, default TR
 * @param MAX_RX_SPEED Max Receive speed,unit: Mbit/s, default 100
 * @param MAX_TX_SPEED Max transmit speed,unit: Mbit/s, default 30
 * @param usage, network usage limit, default 0.6
 */
async function wait_for_low_traffic_usage(INTERFACE = 'eth0', break_time = 5000, TX_RX = 'TR', MAX_RX_SPEED = 100, MAX_TX_SPEED = 30, usage = 0.6) {
  return await new Promise(async (resolve, reject) => {
    if (MAX_RX_SPEED <= 0 && MAX_TX_SPEED <= 0) {
      return reject('Meaningless MAX_SPEED!!!');
    }
    let max_rx = MAX_RX_SPEED * usage / 8;
    let max_tx = MAX_TX_SPEED * usage / 8;
    while (true) {
      let speed = await live_net_speed(INTERFACE, break_time / 5);
      // kb
      speed.RX.raw /= 1024;
      // mb
      speed.RX.raw /= 1024;
      // kb
      speed.TX.raw /= 1024;
      // mb
      speed.TX.raw /= 1024;
      switch (TX_RX) {
        case 'RX':
          if (speed.RX.raw < max_rx) {
            return resolve();
          }
          break;
        case 'TX':
          if (speed.TX.raw < max_tx) {
            return resolve();
          }
          break;
        case "TR":
          if (speed.RX.raw < max_rx && speed.TX.raw < max_tx) {
            return resolve();
          }
          break;
        default:
          throw new Error('Error TX_RX param!!!');
      }
      console.info(`[${date.getFullYear()}\
-${date.getMonth()}\
-${date.getDate()} \
${date.getHours()}:${date.getMinutes()}] \
Waiting ${break_time / 1000}s for low traffic usage...`);
      await sleep(break_time);
    }
  });
}

/**
 * Simple packaging got
 * @param prefixUrl {String | URL} got prefixUrl
 * @param token {String} huaweicloud IAM Token
 * @param json_body POST BODY, NULL for GET Method
 * @return {Got} Got instance
 * @see https://github.com/sindresorhus/got
 * <br>
 * @see https://apiexplorer.developer.huaweicloud.com/apiexplorer/doc
 */
function got_instance(prefixUrl, token, json_body = null) {
  try {
    new URL(prefixUrl)
  } catch (ERR_INVALID_URL) {
    throw new Error('Invalid prefixUrl!!!');
  }
  let op = {
    prefixUrl: prefixUrl,
    headers: {
      'content-type': 'application/json;charset=utf8',
      'X-Auth-Token': token
    },
    responseType: "json",
    json: json_body
  }
  // Remove empty param
  // op = _.pickBy(op,!_.isNil);
  if (json_body === null) {
    delete op["json"];
  }
  return got.extend(op);
}

/**
 * huaweicloud common api operation
 * @param prefixUrl prefixUrl {String | URL} got prefixUrl
 * @param api_url API URL which shouldn't start with '/'
 * @param body request body
 * @param token {String} huaweicloud IAM TOKEN
 * @param instance Got instance, default null
 * @return {JSON | Error}
 * @see https://github.com/sindresorhus/got
 * <br>
 * @see https://apiexplorer.developer.huaweicloud.com/apiexplorer/doc
 */
async function hwc_common(prefixUrl, api_url, body, token, instance = null) {
  return await new Promise(async (resolve, reject) => {
    instance = instance === null
      ? instance = got_instance(prefixUrl, token, body)
      : instance;
    await wait_for_low_traffic_usage();
    instance.post(api_url)
      .then(res => {
        if (res.statusCode === 200) {
          return resolve({
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            body: res.body
          });
        } else {
          return reject({
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            body: res.body
          });
        }
      })
      .catch(e => {
        return reject(e);
      });
  });
}


/**
 * Give a string or array, get a compact array
 * @param array {String | Array} Input array or string
 * @return {Array} Output array without null object
 * @see https://www.lodashjs.com/docs/lodash.compact
 */
function checkUrl(array) {
  if (_.isArray(array)) {
    return _.compact(array);
  } else if (typeof array === 'string') {
    try {
      new URL(array);
      return [array];
    } catch (e) {
      return [];
    }
  } else {
    return [];
  }
}

/**
 * Get huaweicloud IAM TOKEN
 * @return {JSON} huaweicloud IAM TOKEN
 * @see https://apiexplorer.developer.huaweicloud.com/apiexplorer/debug?product=IAM&api=KeystoneCreateUserTokenByPassword
 */
async function getToken() {
  return await new Promise(async (resolve, reject) => {
    let userInfo = {
      "auth": {
        "identity": {
          "methods": [
            "password"
          ],
          "password": {
            "user": {
              "domain": {
                "name": USER_DOMAIN_NAME
              },
              "name": NAME,
              "password": PASSWORD
            }
          }
        },
        "scope": {
          "domain": {
            "name": SCOPE_DOMAIN_NAME
          }
        }
      }
    }
    await wait_for_low_traffic_usage();
    got_instance(API.IAM.END_POINT, "", userInfo)
      .post(API.IAM.KeystoneCreateUserTokenByPassword)
      .then(res => {
        if (res.statusCode === 201) {
          return resolve({
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            x_subject_token: res.headers['x-subject-token'],
            // We don't need it
            // body: res.body
          });
        } else {
          return reject({
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
          });
        }
      })
      .catch(e => {
        return reject(e);
      })
  })
}


/**
 * huaweicloud cdn preheatingtasks
 * @param array {Array | String}
 * @param token {String} huaweicloud IAM TOKEN
 * @param instance Got instance, default null
 * @return {JSON | Error} result
 * @see https://apiexplorer.developer.huaweicloud.com/apiexplorer/debug?product=CDN&api=CreatePreheatingTasks
 */
async function cdn_preheatingtasks(array, token, instance = null) {
  return await new Promise((resolve, reject) => {
    let tmpArray = checkUrl(array);
    if (tmpArray.length === 0) {
      return reject('Invalid Input!!!');
    }
    let body = {
      "preheatingTask": {
        "urls": tmpArray
      }
    };
    hwc_common(API.CDN.END_POINT, API.CDN.preheatingtasks, body, token, instance)
      // got_instance(API.CDN.END_POINT,token,body)
      .then(res => {
        return resolve(res);
      })
      .catch(e => {
        return reject(e);
      })
  });
}

/**
 * huaweicloud cdn refreshtasks
 * @param array {Array | String}
 * @param token {String} huaweicloud IAM TOKEN
 * @param types {'file'|'directory'} refresh types, default 'file'
 * @param instance Got instance, default null
 * @return {JSON | Error} result
 * @see https://apiexplorer.developer.huaweicloud.com/apiexplorer/doc?product=CDN&api=CreateRefreshTasks
 */
async function cdn_refreshtasks(array, token, types = "file", instance = null) {
  return await new Promise((resolve, reject) => {
    let tmpArray = checkUrl(array);
    if (tmpArray.length === 0) {
      return reject('Invalid Input!!!');
    }
    let body = {
      "refreshTask": {
        "type": types,
        "urls": tmpArray
      }
    };
    hwc_common(API.CDN.END_POINT, API.CDN.refreshtasks, body, token, instance)
      // got_instance(API.CDN.END_POINT,token,body)
      .then(res => {
        return resolve(res);
      })
      .catch(e => {
        return reject(e);
      })
  })
}

/**
 * huaweicloud cdn refreshtasks
 * @param history_tasks_id TaskID
 * @param token {String} huaweicloud IAM TOKEN
 * @param instance Got instance, default null
 * @return {JSON | Error} result
 * @see https://apiexplorer.developer.huaweicloud.com/apiexplorer/mock?product=CDN&api=ShowHistoryTaskDetails
 */
async function showHistoryTaskDetails(token, history_tasks_id, instance = null) {
  return await new Promise(async (resolve, reject) => {
    if (_.isNaN(history_tasks_id)) {
      return reject('Empty history_tasks_id');
    }
    instance = instance === null
      ? instance = got_instance(API.CDN.END_POINT, token)
      : instance;
    await wait_for_low_traffic_usage();
    instance.get(API.CDN.ShowHistoryTaskDetails.replace('history_tasks_id', history_tasks_id))
      .then(res => {
        if (res.statusCode === 200) {
          return resolve({
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            body: res.body
          });
        } else {
          return reject({
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            body: res.body
          });
        }
      })
      .catch(e => {
        return reject(e);
      });
  });
}

/**
 * wait for refresh task done
 * @param token {String} huaweicloud IAM TOKEN
 * @param refreshTaskId {Number} cdn refresh Task ID
 * @param MAX_TRY Maximum attempts
 * @param query_break {Number} setTimeout time unit
 * @param instance  Got instance, default null
 * @return {Array | Number | Error}
 * Number for succeed task numbers
 * <br>
 * Array for failed task array
 * <br>
 * Error for other error
 */
async function waitForRefreshTaskDone(token, refreshTaskId, MAX_TRY = 10 * 6, query_break = 2 * 10 * 1000, instance) {
  return await new Promise(async (resolve, reject) => {
    let try_time = 0;
    while (true) {
      if (++try_time > MAX_TRY) {
        return reject('Maximum number of attempts reached!!!');
      }
      try {
        let cdn_detail = await showHistoryTaskDetails(token, refreshTaskId, instance);
        if (cdn_detail.body.status === 'task_done') {
          if (cdn_detail.body.succeed === cdn_detail.body.urls.length) {
            // return if all task is succeed
            return resolve(cdn_detail.body.succeed)
          } else {
            let failedArray = (() => {
              let urls = cdn_detail.body.urls;
              let tmp = [];
              urls.forEach(url => {
                if (url.status === 'failed') {
                  tmp.push(url)
                }
              });
              return tmp;
            })();
            if (failedArray.length === 0) {
              return reject('Internal Error!!!');
            } else {
              return reject(failedArray);
            }
          }
        }
      } catch (e) {
        return reject(e);
      }
      console.info(`[${date.getFullYear()}\
-${date.getMonth()}\
-${date.getDate()} \
${date.getHours()}:${date.getMinutes()}]: \
Waiting ${query_break / 1000}s for next query...`);
      await sleep(query_break);
    }
  })
}

/**
 * cdn preHeating task
 * <br>
 * @param token {String} huaweicloud IAM TOKEN
 * @param preHeatArray {Array} pre-heating url array
 * @param MAX_TRY Maximum attempts
 * @param QUERY_BREAK {Number} setTimeout time unit
 * @param chunk_size
 * @param got_instance Got instance, default null
 *
 * As we know, one we commit the preHeatingTask, more than
 * one cdn node will get resource file from the source
 * site via public Internet.
 * <br>
 * So, the source site's traffic will be very busy after
 * we commit the task.
 * If too many URLs are submitted in a short time, most tasks will fail.
 * <br>
 * huaweicloud will retry once if connection time is more than 30s.
 */
async function cdn_preheating(token, preHeatArray, MAX_TRY = 10 * 6, QUERY_BREAK = 10 * 100, chunk_size = 10, got_instance = null) {
  return await new Promise(async (resolve, reject) => {
    if (!_.isArray(preHeatArray)) {
      return reject('preHeatArray must be a array');
    }
    if (preHeatArray.length === 0) {
      return reject('preHeatArray is empty')
    }
    preHeatArray = _.chunk(preHeatArray, chunk_size);
    // failed urls array
    let failed = [];
    await async.mapLimit(preHeatArray, 1, async (subArray, callback) => {
      let tmpArr = subArray;
      for (let i = 0; i < MAX_TRY; i++) {
        let cdn_pre = await cdn_preheatingtasks(tmpArr, token);
        await waitForRefreshTaskDone(token, cdn_pre.body.preheatingTask.id, MAX_TRY, QUERY_BREAK, got_instance)
          .then(res => {
            if (res === subArray.length) {
              // i = MAX_TRY;
              return callback;
            }
          })
          .catch(e => {
            if (_.isArray(e)) {
              if (i !== MAX_TRY - 1) {
                // Retry
                tmpArr = e;
              } else {
                failed = failed.concat(e);
              }
            } else {
              // Other error
              console.error(e);
              return callback;
              // return reject(e);
            }
          });
      }
      return callback;
    })
      .finally(() => {
        return resolve(failed);
      });
  })
}

module.exports = {
  getToken,
  cdn_refreshtasks,
  cdn_preheatingtasks,
  cdn_preheating,
  showHistoryTaskDetails,
  waitForRefreshTaskDone,
  sleep,
  get_bytes,
  live_net_speed,
  human_net_speed,
  wait_for_low_traffic_usage,
}