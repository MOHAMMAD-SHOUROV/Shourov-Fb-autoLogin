import { Router, type IRouter } from "express";
import healthRouter from "./health";
import extensionRouter from "./extension";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(extensionRouter);
router.use(adminRouter);

export default router;
