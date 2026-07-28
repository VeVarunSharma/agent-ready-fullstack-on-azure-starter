import { healthContract } from "./health";

export { HEALTH_ROUTE, healthContract, healthResponseSchema, type HealthResponse } from "./health";

export const apiV1Contract = {
  health: healthContract,
};
