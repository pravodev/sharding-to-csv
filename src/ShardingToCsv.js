import iconv from 'iconv-lite';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { Readline } from './utils/Readline';

export class ShardingToCsv extends EventEmitter {
  constructor(file, opts) {
    super();
    if(typeof(file) !== 'string') {  throw new Error('Param file invalid!'); }
    if(typeof(opts) !== 'object') {  throw new Error('Param opts invalid!'); }
    this._file = file;
    this._opts = opts || {};
    this._initialize();
  }

  shard() {
    let rl = new Readline(fs.createReadStream(this._file).pipe(iconv.decodeStream(this._opts.encoding)));

    rl.on('line', (line, lineCount, byteCount) => this._writeLine(line, lineCount, byteCount));

    rl.on('close', () => {
      if(fs.existsSync(this._file)) {
        fs.unlinkSync(this._file);
      }
      this.emit('completed', this._count);
    });

    rl.on('error', (err) => this.emit('error', err));

    return this;
  }

  _initialize() {
    this._opts.encoding = this._opts.encoding  || 'utf-8';
    this._opts.maxFileSize = this._opts.maxFileSize || 536870912;
    this._count = 0;
    this._bytes = 0;
    this._filename = path.basename(this._file, path.extname(this._file));
    this._writeStream = fs.createWriteStream(`${path.dirname(this._file)}/${this._filename}-${this._count}.csv`);
  }

  _writeLine(line, lineCount, byteCount) {
    let encodingLine = iconv.encode(`${line}\n`, this._opts.encoding);
    this._bytes += line.length;

    if(lineCount === 0) {
      this._setHeaderFile(encodingLine);
    }

    this._writeStream.write(encodingLine);

    if(this._bytes >= this._opts.maxFileSize) {
      this._bytes = 0;
      this._writeStream.end();
      this._newShard();
    }
  }

  _setHeaderFile(line) {
    this._header = line;
  }

  _newShard() {
    this._count++;
    this._writeStream = fs.createWriteStream(`${path.dirname(this._file)}/${this._filename}-${this._count}.csv`);
    this._writeStream.write(this._header);
  }
}
