/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      getSession: FunctionReference<
        "query",
        "internal",
        { sessionId: string },
        {
          _creationTime: number;
          _id: string;
          contextId?: string;
          endedAt?: number;
          error?: string;
          lastUrl?: string;
          persistContext?: boolean;
          region: "us-west-2" | "us-east-1" | "eu-central-1" | "ap-southeast-1";
          sessionId: string;
          startedAt: number;
          status: "active" | "completed" | "error";
        } | null,
        Name
      >;
      recordSession: FunctionReference<
        "mutation",
        "internal",
        {
          contextId?: string;
          lastUrl?: string;
          persistContext?: boolean;
          region: "us-west-2" | "us-east-1" | "eu-central-1" | "ap-southeast-1";
          sessionId: string;
        },
        null,
        Name
      >;
      updateSession: FunctionReference<
        "mutation",
        "internal",
        {
          endedAt?: number;
          error?: string;
          lastUrl?: string;
          sessionId: string;
          status?: "active" | "completed" | "error";
        },
        null,
        Name
      >;
    };
  };
