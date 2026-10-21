import type { EnrolledPartnerProps } from "@/lib/types";
import { nanoid } from "@dub/utils";
import { expect } from "@playwright/test";
import { apiError } from "../../utils";
import { test, type ApiClient } from "../fixtures";
import { createPartner, deletePartner } from "./helpers";

async function expectPartnerStatus(
  api: ApiClient,
  partnerId: string,
  status: string,
) {
  const { status: httpStatus, data } = await api.get<EnrolledPartnerProps>(
    `/api/partners/${partnerId}`,
  );

  expect(httpStatus).toEqual(200);
  expect(data).toMatchObject({ id: partnerId, status });
}

test("POST /partners/reactivate – by partnerId", async ({ api, program }) => {
  let partnerId: string | undefined;

  try {
    const { status: createStatus, data: created } = await createPartner(api, {
      groupId: program.defaultGroupId,
    });
    partnerId = created.id;
    expect(createStatus).toEqual(201);

    const { status: deactivateStatus } = await api.post(
      "/api/partners/deactivate",
      { partnerId },
    );
    expect(deactivateStatus).toEqual(200);
    await expectPartnerStatus(api, partnerId, "deactivated");

    const { status, data } = await api.post<{ partnerId: string }>(
      "/api/partners/reactivate",
      { partnerId },
    );

    expect(status).toEqual(200);
    expect(data).toStrictEqual({ partnerId });

    await expectPartnerStatus(api, partnerId, "approved");
  } finally {
    await deletePartner(partnerId);
  }
});

test("POST /partners/reactivate – by tenantId", async ({ api, program }) => {
  let partnerId: string | undefined;
  const tenantId = nanoid();

  try {
    const { status: createStatus, data: created } = await createPartner(api, {
      tenantId,
      groupId: program.defaultGroupId,
    });
    partnerId = created.id;
    expect(createStatus).toEqual(201);

    const { status: deactivateStatus } = await api.post(
      "/api/partners/deactivate",
      { tenantId },
    );
    expect(deactivateStatus).toEqual(200);

    const { status, data } = await api.post<{ partnerId: string }>(
      "/api/partners/reactivate",
      { tenantId },
    );

    expect(status).toEqual(200);
    expect(data).toStrictEqual({ partnerId });

    await expectPartnerStatus(api, partnerId, "approved");
  } finally {
    await deletePartner(partnerId);
  }
});

test("POST /partners/reactivate – partner not deactivated", async ({
  api,
  program,
}) => {
  let partnerId: string | undefined;

  try {
    const { data: created } = await createPartner(api, {
      groupId: program.defaultGroupId,
    });
    partnerId = created.id;

    expect(await api.post("/api/partners/reactivate", { partnerId })).toEqual(
      apiError({
        code: "bad_request",
        message:
          'Only partners with a "deactivated" status can be reactivated. The partner\'s status in this program is "approved".',
      }),
    );
  } finally {
    await deletePartner(partnerId);
  }
});

test("POST /partners/reactivate – partner not found", async ({
  api,
  program,
}) => {
  const partnerId = `pn_${nanoid()}`;

  expect(await api.post("/api/partners/reactivate", { partnerId })).toEqual(
    apiError({
      code: "not_found",
      message: `Partner ${partnerId} is not enrolled in program ${program.id}.`,
    }),
  );
});

test("POST /partners/reactivate – tenantId not found", async ({ api }) => {
  const tenantId = nanoid();

  expect(await api.post("/api/partners/reactivate", { tenantId })).toEqual(
    apiError({
      code: "not_found",
      message: `Partner with tenantId ${tenantId} not found in program.`,
    }),
  );
});

test("POST /partners/reactivate – missing partnerId and tenantId", async ({
  api,
}) => {
  expect(await api.post("/api/partners/reactivate", {})).toEqual(
    apiError({
      code: "bad_request",
      message: "Either `partnerId` or `tenantId` must be provided.",
    }),
  );
});
