import { trackActivityLog } from "@/lib/api/activity-log/track-activity-log";
import { getGroupOrThrow } from "@/lib/api/groups/get-group-or-throw";
import { linkCache } from "@/lib/api/links/cache";
import { Session } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { waitUntil } from "@vercel/functions";
import { DubApiError } from "../errors";
import { getProgramEnrollmentOrThrow } from "../programs/get-program-enrollment-or-throw";
import { queuePartnerSearchSync } from "./queue-partner-search-sync";

interface ReactivatePartnerParams {
  workspaceId: string;
  programId: string;
  partnerId: string;
  user?: Session["user"];
}

export async function reactivatePartner({
  workspaceId,
  programId,
  partnerId,
  user,
}: ReactivatePartnerParams) {
  const programEnrollment = await getProgramEnrollmentOrThrow({
    programId,
    partnerId,
    include: {
      program: true,
    },
  });

  if (programEnrollment.status !== "deactivated") {
    throw new DubApiError({
      code: "bad_request",
      message: `Only partners with a "deactivated" status can be reactivated. The partner's status in this program is "${programEnrollment.status}".`,
    });
  }

  const partnerGroup = await getGroupOrThrow({
    programId,
    groupId:
      programEnrollment.groupId || programEnrollment.program.defaultGroupId,
  });

  const where = {
    programId,
    partnerId,
  };

  await prisma.$transaction([
    prisma.link.updateMany({
      where,
      data: {
        expiresAt: null,
      },
    }),

    prisma.programEnrollment.update({
      where: {
        partnerId_programId: where,
      },
      data: {
        status: "approved",
        groupId: partnerGroup.id,
        clickRewardId: partnerGroup.clickRewardId,
        leadRewardId: partnerGroup.leadRewardId,
        saleRewardId: partnerGroup.saleRewardId,
        referralRewardId: partnerGroup.referralRewardId,
        customRewardId: partnerGroup.customRewardId,
        discountId: partnerGroup.discountId,
      },
    }),
  ]);

  waitUntil(
    (async () => {
      const links = await prisma.link.findMany({
        where,
        select: {
          domain: true,
          key: true,
        },
      });

      await Promise.allSettled([
        // TODO send email to partner
        linkCache.expireMany(links),

        // Queue an index update because the enrollment status moved back to approved
        queuePartnerSearchSync({ partnerIds: [partnerId], programId }),

        user &&
          trackActivityLog({
            workspaceId,
            programId,
            resourceType: "partner",
            resourceId: partnerId,
            userId: user.id,
            action: "partner.reactivated",
            changeSet: {
              status: {
                old: "deactivated",
                new: "approved",
              },
            },
          }),
      ]);
    })(),
  );
}
