import { raw, Router } from 'express';
import { webhookController } from '../controllers';

const router = Router();

// Svix signature verification requires the untouched raw request body, so this
// route parses its own body instead of relying on the global JSON parser.
router.post('/clerk', raw({ type: 'application/json' }), webhookController.handleClerkWebhook);

export default router;
