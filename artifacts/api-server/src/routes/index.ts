import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountRouter from "./account";
import projectsRouter from "./projects";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountRouter);
router.use(projectsRouter);

export default router;
