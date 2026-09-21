import { raw, Router } from 'express';
import { webhookController } from '../controllers';

const router = Router();

// Svix signature verification requires the untouched raw request body, so this
// route parses its own body instead of relying on the global JSON parser.
router.post('/clerk', raw({ type: 'application/json' }), webhookController.handleClerkWebhook);

// Same reasoning — GitHub's HMAC signature is computed over the exact raw bytes it sent.
router.post('/github', raw({ type: 'application/json' }), webhookController.handleGithubWebhook);

export default router;
