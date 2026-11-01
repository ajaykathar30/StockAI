import { Router, Request, Response } from 'express';
import { Job } from '../models/Job';

const router = Router();

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const job = await Job.findOne({ jobId: req.params.id });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.json({
      success: true,
      job: {
        jobId: job.jobId,
        type: job.type,
        status: job.status,
        progressPercent: job.progressPercent,
        message: job.message,
        error: job.error,
        resultPayload: job.resultPayload,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
