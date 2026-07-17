import { Router } from 'express';

const router = Router();

// ==========================================
// DATASET: CUSTOMER DATABASE (SILVER LAYER)
// OWNER: LEONARD
// ==========================================

// Endpoint to fetch unresolved records (e.g., impossible birthdays)
router.get('/unresolved', async (req, res) => {
  try {
    // TODO (Leonard): Query the database for records flagged by the bronze python script
    res.json({
      success: true,
      records: [
        { id: 101, field: 'birthday', value: '2025-05-12', issue: 'Future Date Flag' }
      ]
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint for the user to resolve an anomaly from the frontend
router.post('/resolve', async (req, res) => {
  try {
    const { recordId, correctedValue } = req.body;
    // TODO (Leonard): Update the record, change status from 'unresolved' to 'clean'
    
    res.json({
      success: true,
      message: `Record ${recordId} resolved. Ready for Gold.`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
