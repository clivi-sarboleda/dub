import { openApiErrorResponses } from "@/lib/openapi/responses";
import { reactivatePartnerApiSchema } from "@/lib/zod/schemas/partners";
import { ZodOpenApiOperationObject } from "zod-openapi";
import * as z from "zod/v4";

export const reactivatePartner: ZodOpenApiOperationObject = {
  operationId: "reactivatePartner",
  "x-speakeasy-name-override": "reactivate",
  summary: "Reactivate a partner",
  description:
    "This will reactivate a deactivated partner in your program and re-enable their links. The partner is moved back to the approved status with their group's rewards and discount.",
  requestBody: {
    content: {
      "application/json": {
        schema: reactivatePartnerApiSchema,
      },
    },
  },
  responses: {
    "200": {
      description: "The reactivated partner",
      content: {
        "application/json": {
          schema: z.object({
            partnerId: z
              .string()
              .describe("The ID of the reactivated partner."),
          }),
        },
      },
    },
    ...openApiErrorResponses,
  },
  tags: ["Partners"],
  security: [{ token: [] }],
};
