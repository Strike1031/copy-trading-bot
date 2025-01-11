import { Application, Router } from "express";
import verifyToken from "../middleware/index";
import apiController from "../controllers/api.controller";

export default (app: Application): void => {
  const router: Router = Router();

  // Define routes with proper typing
  router.get("/getWalletAddress/:userId", apiController.getUserInfo); // Get the user info
  router.post("/withdraw", apiController.withdraw);
  router.post("/addMirror", apiController.addMirror);
  router.post("/removeMirror", apiController.removeMirror);

  // Use the router in the app
  app.use("/api", router);
};
