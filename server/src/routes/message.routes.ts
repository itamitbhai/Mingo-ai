import { Router } from 'express';
import { messageController } from '../controllers';
import { aiMessageRateLimiter, validate } from '../middlewares';
import { messageQuerySchema, sendMessageSchema } from '../validators';

const router = Router({ mergeParams: true });

router.get('/', validate(messageQuerySchema, 'query'), messageController.listMessages);
router.post('/', aiMessageRateLimiter, validate(sendMessageSchema), messageController.postMessage);

export default router;
