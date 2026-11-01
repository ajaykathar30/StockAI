import { v4 as uuidv4 } from 'uuid';
import { Job, IJob } from '../models/Job';
import { JobStatus } from '@quickstock/shared';

type JobHandler = (
  job: IJob,
  updateProgress: (percent: number, message: string) => Promise<void>
) => Promise<any>;

class SimpleJobQueue {
  private activeJobsCount = 0;
  private maxConcurrency = 2;
  private queue: Array<{ jobId: string; handler: JobHandler }> = [];

  constructor() {
    this.cleanupStaleJobs();
  }

  async cleanupStaleJobs() {
    try {
      const updated = await Job.updateMany(
        { status: JobStatus.RUNNING },
        {
          $set: {
            status: JobStatus.FAILED,
            error: 'Job interrupted due to server restart',
            updatedAt: new Date()
          }
        }
      );
      if (updated.modifiedCount > 0) {
        console.log(`[JobQueue] Recovered ${updated.modifiedCount} stale running jobs.`);
      }
    } catch (e) {
      console.warn('[JobQueue] Could not clean stale jobs on init:', e);
    }
  }

  async enqueue(
    type: 'IMPORT' | 'TRAINING' | 'FORECAST' | 'SIMULATION' | 'REPORT',
    handler: JobHandler
  ): Promise<IJob> {
    const jobId = `job_${type.toLowerCase()}_${Date.now()}_${uuidv4().substring(0, 6)}`;
    const job = await Job.create({
      jobId,
      type,
      status: JobStatus.QUEUED,
      progressPercent: 0,
      message: 'Job submitted and queued for execution'
    });

    this.queue.push({ jobId, handler });
    this.processNext();

    return job;
  }

  private async processNext() {
    if (this.activeJobsCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.activeJobsCount++;
    const { jobId, handler } = item;

    const job = await Job.findOne({ jobId });
    if (!job) {
      this.activeJobsCount--;
      this.processNext();
      return;
    }

    job.status = JobStatus.RUNNING;
    job.progressPercent = 5;
    job.message = 'Processing started';
    job.updatedAt = new Date();
    await job.save();

    const updateProgress = async (percent: number, message: string) => {
      await Job.updateOne(
        { jobId },
        {
          $set: {
            progressPercent: Math.min(99, percent),
            message,
            updatedAt: new Date()
          }
        }
      );
    };

    // Execute asynchronously
    (async () => {
      try {
        const result = await handler(job, updateProgress);
        await Job.updateOne(
          { jobId },
          {
            $set: {
              status: JobStatus.COMPLETED,
              progressPercent: 100,
              message: 'Execution completed successfully',
              resultPayload: result,
              updatedAt: new Date()
            }
          }
        );
      } catch (err: any) {
        console.error(`[JobQueue] Job ${jobId} failed:`, err);
        await Job.updateOne(
          { jobId },
          {
            $set: {
              status: JobStatus.FAILED,
              progressPercent: 100,
              error: err.message || 'Unknown processing error',
              updatedAt: new Date()
            }
          }
        );
      } finally {
        this.activeJobsCount--;
        this.processNext();
      }
    })();
  }
}

export const jobQueue = new SimpleJobQueue();
