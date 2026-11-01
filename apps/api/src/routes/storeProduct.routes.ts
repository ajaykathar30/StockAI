import { Router, Request, Response } from 'express';
import { StoreProduct } from '../models/StoreProduct';
import { Dataset } from '../models/Dataset';

const router = Router();

// GET list of store products
router.get('/', async (req: Request, res: Response) => {
  try {
    const { storeId, category, search, page = '1', limit = '50' } = req.query;

    const query: any = {};
    if (storeId && storeId !== 'ALL') query.store_id = storeId;
    if (category && category !== 'ALL') query.category = category;
    if (search) {
      query.$or = [
        { product_id: { $regex: search, $options: 'i' } },
        { store_id: { $regex: search, $options: 'i' } }
      ];
    }

    const p = parseInt(page as string, 10);
    const l = parseInt(limit as string, 10);

    const [items, total] = await Promise.all([
      StoreProduct.find(query)
        .sort({ store_id: 1, product_id: 1 })
        .skip((p - 1) * l)
        .limit(l),
      StoreProduct.countDocuments(query)
    ]);

    // Unique stores and categories for dropdowns
    const [stores, categories] = await Promise.all([
      StoreProduct.distinct('store_id'),
      StoreProduct.distinct('category')
    ]);

    res.json({
      success: true,
      items,
      total,
      page: p,
      totalPages: Math.ceil(total / l),
      filterOptions: { stores, categories }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update single store product
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const update = req.body;
    update.updatedAt = new Date();
    const item = await StoreProduct.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!item) {
      return res.status(404).json({ success: false, error: 'Store product not found' });
    }
    res.json({ success: true, item });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST bulk update parameters (e.g. adjust lead time or service level for an entire store or category)
router.post('/bulk-update', async (req: Request, res: Response) => {
  try {
    const { filter, updates } = req.body;
    const query: any = {};
    if (filter?.storeId) query.store_id = filter.storeId;
    if (filter?.category) query.category = filter.category;

    updates.updatedAt = new Date();
    const result = await StoreProduct.updateMany(query, { $set: updates });
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
