import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

/**
 * 파일 스토리지 추상화. MVP는 로컬 FS, 추후 S3/R2 구현으로 교체 가능.
 */
export interface Storage {
  put(key: string, data: Buffer): Promise<string>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  resolve(key: string): string;
}

class LocalStorage implements Storage {
  private root = path.resolve(config.LOCAL_UPLOAD_DIR);

  async put(key: string, data: Buffer): Promise<string> {
    const full = path.join(this.root, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(this.resolve(key));
  }

  resolve(key: string): string {
    return path.join(this.root, key);
  }
}

export const storage: Storage = new LocalStorage();
