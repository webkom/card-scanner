const SerialPort = require('serialport');
const memoize = require('lodash.memoize');
const debounce = require('lodash.debounce');

let port = null;
const READ_DELAY = 500;

const commands = {
  BUZZER: 0x89,
  MIFARE: {
    GET_SNR: 0x25
  }
};

const replies = {
  '0': 'OK', // eslint-disable-line
  '1': 'ERROR', // eslint-disable-line
  '83': 'NO CARD', // eslint-disable-line
  '87': 'UNKNOWN INTERNAL ERROR', // eslint-disable-line
  '85': 'UNKNOWN COMMAND', // eslint-disable-line
  '84': 'RESPONSE ERROR', // eslint-disable-line
  '82': 'READER TIMEOUT', // eslint-disable-line
  '90': 'CARD DOES NOT SUPPORT THIS COMMAND', // eslint-disable-line
  '8f': 'UNSUPPORTED CARD IN NFC WRITE MODE' // eslint-disable-line
};

const calculateChecksum = (command, data) => {
  const payload = [data.length + 1, command, ...data];
  const checksum = payload.reduce(
    (previousValue, currentValue) => previousValue ^ currentValue
  );
  return [...payload, checksum];
};

const poll = () => {
  const command = createMessage(commands.MIFARE.GET_SNR, [0x26, 0x00]);
  writeAndDrain(command, poll);
};

const writeAndDrain = (data, callback) => {
  port.write(data, () => {
    port.drain(callback);
  });
};

const validate = (data, checksum) => {
  const dataDecimal = data.map(item => parseInt(item, 16));
  const calculatedChecksum = dataDecimal.reduce(
    (previousValue, currentValue) => previousValue ^ currentValue
  );
  return Math.abs(calculatedChecksum % 255) === parseInt(checksum, 16);
};

const memoizeDebounce = (func, wait = 0, options = {}) => {
  const mem = memoize(param => debounce(func, wait, options));
  return (data, cb) => mem(data)(data, cb);
};

const updateOrDebounce = memoizeDebounce((data, cb) => cb(data), READ_DELAY, {
  leading: true,
  trailing: false
});

const onData = (response, cb, disableThrottle) => {
  const hexValues = [];
  for (let i = 0; i < response.length; i += 1) {
    hexValues.push(response[i].toString(16));
  }
  const stationId = hexValues[1];
  const length = hexValues[2];
  const status = hexValues[3];
  const flag = hexValues[4];
  const data = hexValues.slice(5, hexValues.length - 1);
  const checksum = hexValues[hexValues.length - 1];
  const valid = validate([stationId, length, status, flag, ...data], checksum);
  if (replies[status] === 'OK' && replies[flag] !== 'NO CARD' && valid) {
    if (disableThrottle) {
      cb(data.join(':'));
    } else {
      updateOrDebounce(data.join(':'), cb);
    }
  }
};

const createMessage = (command, data) => {
  const payload = calculateChecksum(command, data);
  return new Buffer([0xaa, 0x00, ...payload, 0xbb]);
};

// Populate the list of available devices
export const refresh = () => SerialPort.list().then(ports => ports);

// Handle the 'Connect' button
export const connect = (devicePath, cb, disableThrottle = false) => {
  return new Promise((resolve, reject) => {
    port = new SerialPort(devicePath, { autoOpen: false });
    port.open(err => {
      if (err) reject(err);
      const Delimiter = SerialPort.parsers.Delimiter;
      const parser = port.pipe(new Delimiter({ delimiter: [0xbb] }));
      parser.on('data', res => onData(res, cb, disableThrottle));
      poll();
      resolve();
    });
  });
};
