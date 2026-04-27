const page1 = {
  items: Array.from({ length: 20 }).map((_, i) => ({
    _id: `p1-${i}`,
    tenantId: "demo-tenant",
    actorId: "u",
    actorName: "User",
    type: "comment",
    entityId: `entity-${i}`,
    metadata: {},
    createdAt: new Date(Date.UTC(2024, 0, 20 - i, 12, 0, 0)).toISOString(),
  })),
  nextCursor: new Date(Date.UTC(2024, 0, 0, 12, 0, 0)).toISOString(),
  hasMore: true,
};

const page2 = {
  items: Array.from({ length: 5 }).map((_, i) => ({
    _id: `p2-${i}`,
    tenantId: "demo-tenant",
    actorId: "u",
    actorName: "User",
    type: "comment",
    entityId: `older-${i}`,
    metadata: {},
    createdAt: new Date(Date.UTC(2023, 11, 10 - i, 12, 0, 0)).toISOString(),
  })),
  nextCursor: null,
  hasMore: false,
};

describe("Activity feed", () => {
  it("loads first page and loads more on scroll", () => {
    cy.intercept("GET", "**/activities*", (req) => {
      if (req.query.cursor) {
        req.reply(page2);
      } else {
        req.reply(page1);
      }
    }).as("activities");

    cy.visit("/");
    cy.wait("@activities");
    cy.get('[data-testid="activity-row"]').should("have.length", 20);
    cy.get('[data-testid="scroll-sentinel"]').scrollIntoView();
    cy.wait("@activities");
    cy.get('[data-testid="activity-row"]').should("have.length", 25);
  });

  it("rolls back optimistic row when POST fails", () => {
    cy.intercept("GET", "**/activities*", { items: [], nextCursor: null, hasMore: false }).as(
      "activities",
    );
    cy.intercept("POST", "**/activities", { statusCode: 500, body: { error: "fail" } }).as(
      "create",
    );

    cy.visit("/");
    cy.wait("@activities");
    cy.get('[data-testid="create-form"] input[name="actorId"]').type("a1");
    cy.get('[data-testid="create-form"] input[name="actorName"]').type("Alex");
    cy.get('[data-testid="create-form"] input[name="entityId"]').type("e99");
    cy.get('[data-testid="create-form"] button[type="submit"]').click();
    cy.wait("@create");
    cy.get('[data-testid="form-error"]').should("be.visible");
    cy.get('[data-testid="activity-row"]').should("not.exist");
  });

  it("shows empty state when filter hides all items", () => {
    cy.intercept("GET", "**/activities*", {
      items: [
        {
          _id: "only",
          tenantId: "demo-tenant",
          actorId: "u",
          actorName: "User",
          type: "comment",
          entityId: "e",
          metadata: {},
          createdAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
      hasMore: false,
    });

    cy.visit("/");
    cy.get('[data-testid="type-filter"]').select("create");
    cy.get('[data-testid="empty-state"]').should("be.visible");
  });
});
