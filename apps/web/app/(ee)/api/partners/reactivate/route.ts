import { DubApiError } from "@/lib/api/errors";
import { reactivatePartner } from "@/lib/api/partners/reactivate-partner";
import { getDefaultProgramIdOrThrow } from "@/lib/api/programs/get-default-program-id-or-throw";
import { parseRequestBody } from "@/lib/api/utils";
import { withWorkspace } from "@/lib/auth";

import { throwIfNoPartnerIdOrTenantId } from "@/lib/partners/throw-if-no-partnerid-tenantid";
import { prisma } from "@/lib/prisma";
import { reactivatePartnerApiSchema } from "@/lib/zod/schemas/partners";
import { NextResponse } from "next/server";

// POST /api/partners/reactivate – Reactivate a partner via API
export const POST = withWorkspace(
  async ({ workspace, req, session }) => {
    let { partnerId, tenantId } = reactivatePartnerApiSchema.parse(
      await parseRequestBody(req),
    );

    throwIfNoPartnerIdOrTenantId({
      partnerId,
      tenantId,
    });

    const programId = getDefaultProgramIdOrThrow(workspace);

    if (tenantId && !partnerId) {
      const programEnrollment = await prisma.programEnrollment.findUnique({
        where: {
          tenantId_programId: {
            tenantId,
            programId,
          },
        },
        select: {
          partnerId: true,
        },
      });

      if (!programEnrollment) {
        throw new DubApiError({
          code: "not_found",
          message: `Partner with tenantId ${tenantId} not found in program.`,
        });
      }

      partnerId = programEnrollment.partnerId;
    }

    await reactivatePartner({
      workspaceId: workspace.id,
      programId,
      partnerId: partnerId!, // coerce here because we're already throwing if no partnerId or tenantId
      user: session.user,
    });

    return NextResponse.json({
      partnerId,
    });
  },
  {
    requiredPermissions: ["partners.write"],
    requiredPlan: ["business", "advanced", "enterprise"],
  },
);
