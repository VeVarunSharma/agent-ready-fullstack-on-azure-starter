import { handleApiV1Request } from "../../../../server/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const HEAD = handleApiV1Request;
export const GET = handleApiV1Request;
export const POST = handleApiV1Request;
export const PUT = handleApiV1Request;
export const PATCH = handleApiV1Request;
export const DELETE = handleApiV1Request;
export const OPTIONS = handleApiV1Request;
