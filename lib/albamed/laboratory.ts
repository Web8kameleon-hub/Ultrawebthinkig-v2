import { albaMedEngine } from './engine';
import { AlbaMedEngineResult, AlbaMedRequest } from './types';

export interface AlbaMedExperimentRecord {
  id: string;
  createdAt: number;
  request: AlbaMedRequest;
  result: AlbaMedEngineResult;
}

export class AlbaMedLaboratory {
  private records: AlbaMedExperimentRecord[] = [];

  async run(request: AlbaMedRequest): Promise<AlbaMedEngineResult> {
    const result = await albaMedEngine.run(request);
    const record: AlbaMedExperimentRecord = {
      id: `lab_${crypto.randomUUID()}`,
      createdAt: Date.now(),
      request,
      result,
    };

    this.records.unshift(record);
    if (this.records.length > 200) {
      this.records = this.records.slice(0, 200);
    }

    return result;
  }

  getRecent(limit = 20): AlbaMedExperimentRecord[] {
    return this.records.slice(0, limit);
  }
}

export const albaMedLaboratory = new AlbaMedLaboratory();
