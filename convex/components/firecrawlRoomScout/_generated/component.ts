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
    crawl: {
      cancel: FunctionReference<
        "action",
        "internal",
        { crawlId: string },
        null,
        Name
      >;
      deleteCrawl: FunctionReference<
        "mutation",
        "internal",
        { crawlId: string },
        null,
        Name
      >;
      get: FunctionReference<
        "query",
        "internal",
        { crawlId: string },
        null | {
          _creationTime: number;
          _id: string;
          completed?: number;
          completedAt?: number;
          context?: any;
          creditsUsed?: number;
          error?: string;
          finalized: boolean;
          jobId?: string;
          mode: "webhook" | "poll";
          pageCount: number;
          startedAt: number;
          status: "scraping" | "completed" | "failed" | "cancelled";
          storeContent: boolean;
          total?: number;
          unstored?: number;
          updatedAt: number;
          url: string;
        },
        Name
      >;
      getByJobId: FunctionReference<
        "query",
        "internal",
        { jobId: string },
        null | {
          _creationTime: number;
          _id: string;
          completed?: number;
          completedAt?: number;
          context?: any;
          creditsUsed?: number;
          error?: string;
          finalized: boolean;
          jobId?: string;
          mode: "webhook" | "poll";
          pageCount: number;
          startedAt: number;
          status: "scraping" | "completed" | "failed" | "cancelled";
          storeContent: boolean;
          total?: number;
          unstored?: number;
          updatedAt: number;
          url: string;
        },
        Name
      >;
      getPage: FunctionReference<
        "query",
        "internal",
        { crawlId: string; url: string },
        null | {
          _creationTime: number;
          _id: string;
          changeTracking?: any;
          crawlId: string;
          html?: string;
          json?: any;
          links?: Array<string>;
          markdown?: string;
          metadata?: any;
          rawHtml?: string;
          scrapedAt: number;
          screenshot?: string;
          summary?: string;
          truncated: boolean;
          url: string;
        },
        Name
      >;
      listCrawls: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          status?: "scraping" | "completed" | "failed" | "cancelled";
        },
        Array<{
          _creationTime: number;
          _id: string;
          completed?: number;
          completedAt?: number;
          context?: any;
          creditsUsed?: number;
          error?: string;
          finalized: boolean;
          jobId?: string;
          mode: "webhook" | "poll";
          pageCount: number;
          startedAt: number;
          status: "scraping" | "completed" | "failed" | "cancelled";
          storeContent: boolean;
          total?: number;
          unstored?: number;
          updatedAt: number;
          url: string;
        }>,
        Name
      >;
      listPages: FunctionReference<
        "query",
        "internal",
        {
          crawlId: string;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            changeTracking?: any;
            crawlId: string;
            html?: string;
            json?: any;
            links?: Array<string>;
            markdown?: string;
            metadata?: any;
            rawHtml?: string;
            scrapedAt: number;
            screenshot?: string;
            summary?: string;
            truncated: boolean;
            url: string;
          }>;
          pageStatus?: string | null;
          splitCursor?: string | null;
        },
        Name
      >;
      resume: FunctionReference<
        "mutation",
        "internal",
        { crawlId: string },
        boolean,
        Name
      >;
      start: FunctionReference<
        "action",
        "internal",
        {
          context?: any;
          mode?: "webhook" | "poll";
          onComplete?: string;
          options?: {
            allowExternalLinks?: boolean;
            allowSubdomains?: boolean;
            crawlEntireDomain?: boolean;
            deduplicateSimilarURLs?: boolean;
            delay?: number;
            excludePaths?: Array<string>;
            extra?: Record<string, any>;
            ignoreQueryParameters?: boolean;
            ignoreRobotsTxt?: boolean;
            includePaths?: Array<string>;
            limit?: number;
            maxConcurrency?: number;
            maxDiscoveryDepth?: number;
            prompt?: string;
            regexOnFullURL?: boolean;
            robotsUserAgent?: string;
            scrapeOptions?: {
              actions?: Array<any>;
              blockAds?: boolean;
              excludeTags?: Array<string>;
              extra?: Record<string, any>;
              formats?: Array<
                | "markdown"
                | "html"
                | "rawHtml"
                | "links"
                | "images"
                | "screenshot"
                | "summary"
                | "changeTracking"
                | "json"
                | "attributes"
                | "branding"
                | "product"
                | "menu"
                | "audio"
                | "video"
                | {
                    fullPage?: boolean;
                    mode?: string;
                    modes?: Array<string>;
                    prompt?: string;
                    quality?: number;
                    query?: string;
                    question?: string;
                    schema?: any;
                    selectors?: Array<{ attribute: string; selector: string }>;
                    tag?: string;
                    type: string;
                    viewport?: { height: number; width: number };
                  }
              >;
              headers?: Record<string, string>;
              includeTags?: Array<string>;
              location?: { country?: string; languages?: Array<string> };
              lockdown?: boolean;
              maxAge?: number;
              minAge?: number;
              mobile?: boolean;
              onlyMainContent?: boolean;
              parsers?: Array<string | any>;
              proxy?: string;
              redactPII?: boolean | any;
              removeBase64Images?: boolean;
              skipTlsVerification?: boolean;
              storeInCache?: boolean;
              timeout?: number;
              waitFor?: number;
              zeroDataRetention?: boolean;
            };
            sitemap?: "only" | "include" | "skip";
            zeroDataRetention?: boolean;
          };
          storeContent?: boolean;
          url: string;
        },
        { crawlId: string; jobId: string },
        Name
      >;
    };
    interact: {
      execute: FunctionReference<
        "action",
        "internal",
        {
          code?: string;
          jobId: string;
          language?: "node" | "python" | "bash";
          mutating: boolean;
          prompt?: string;
          timeout?: number;
        },
        any,
        Name
      >;
      stop: FunctionReference<
        "action",
        "internal",
        { jobId: string },
        any,
        Name
      >;
    };
    lib: {
      map: FunctionReference<
        "action",
        "internal",
        {
          options?: {
            extra?: Record<string, any>;
            ignoreQueryParameters?: boolean;
            includeSubdomains?: boolean;
            limit?: number;
            location?: { country?: string; languages?: Array<string> };
            search?: string;
            sitemap?: "only" | "include" | "skip";
            timeout?: number;
          };
          url: string;
        },
        any,
        Name
      >;
      scrape: FunctionReference<
        "action",
        "internal",
        {
          options?: {
            actions?: Array<any>;
            blockAds?: boolean;
            excludeTags?: Array<string>;
            extra?: Record<string, any>;
            formats?: Array<
              | "markdown"
              | "html"
              | "rawHtml"
              | "links"
              | "images"
              | "screenshot"
              | "summary"
              | "changeTracking"
              | "json"
              | "attributes"
              | "branding"
              | "product"
              | "menu"
              | "audio"
              | "video"
              | {
                  fullPage?: boolean;
                  mode?: string;
                  modes?: Array<string>;
                  prompt?: string;
                  quality?: number;
                  query?: string;
                  question?: string;
                  schema?: any;
                  selectors?: Array<{ attribute: string; selector: string }>;
                  tag?: string;
                  type: string;
                  viewport?: { height: number; width: number };
                }
            >;
            headers?: Record<string, string>;
            includeTags?: Array<string>;
            location?: { country?: string; languages?: Array<string> };
            lockdown?: boolean;
            maxAge?: number;
            minAge?: number;
            mobile?: boolean;
            onlyMainContent?: boolean;
            parsers?: Array<string | any>;
            proxy?: string;
            redactPII?: boolean | any;
            removeBase64Images?: boolean;
            skipTlsVerification?: boolean;
            storeInCache?: boolean;
            timeout?: number;
            waitFor?: number;
            zeroDataRetention?: boolean;
          };
          url: string;
        },
        any,
        Name
      >;
      search: FunctionReference<
        "action",
        "internal",
        {
          options?: {
            categories?: Array<string | any>;
            excludeDomains?: Array<string>;
            extra?: Record<string, any>;
            highlights?: boolean;
            ignoreInvalidURLs?: boolean;
            includeDomains?: Array<string>;
            limit?: number;
            location?: string;
            scrapeOptions?: {
              actions?: Array<any>;
              blockAds?: boolean;
              excludeTags?: Array<string>;
              extra?: Record<string, any>;
              formats?: Array<
                | "markdown"
                | "html"
                | "rawHtml"
                | "links"
                | "images"
                | "screenshot"
                | "summary"
                | "changeTracking"
                | "json"
                | "attributes"
                | "branding"
                | "product"
                | "menu"
                | "audio"
                | "video"
                | {
                    fullPage?: boolean;
                    mode?: string;
                    modes?: Array<string>;
                    prompt?: string;
                    quality?: number;
                    query?: string;
                    question?: string;
                    schema?: any;
                    selectors?: Array<{ attribute: string; selector: string }>;
                    tag?: string;
                    type: string;
                    viewport?: { height: number; width: number };
                  }
              >;
              headers?: Record<string, string>;
              includeTags?: Array<string>;
              location?: { country?: string; languages?: Array<string> };
              lockdown?: boolean;
              maxAge?: number;
              minAge?: number;
              mobile?: boolean;
              onlyMainContent?: boolean;
              parsers?: Array<string | any>;
              proxy?: string;
              redactPII?: boolean | any;
              removeBase64Images?: boolean;
              skipTlsVerification?: boolean;
              storeInCache?: boolean;
              timeout?: number;
              waitFor?: number;
              zeroDataRetention?: boolean;
            };
            sources?: Array<string | any>;
            tbs?: string;
            timeout?: number;
          };
          query: string;
        },
        any,
        Name
      >;
    };
    monitor: {
      create: FunctionReference<
        "action",
        "internal",
        { request: Record<string, any> },
        any,
        Name
      >;
      get: FunctionReference<
        "action",
        "internal",
        { monitorId: string },
        any,
        Name
      >;
      getCheck: FunctionReference<
        "action",
        "internal",
        {
          checkId: string;
          limit?: number;
          monitorId: string;
          skip?: number;
          status?: "same" | "new" | "changed" | "removed" | "error";
        },
        any,
        Name
      >;
      list: FunctionReference<
        "action",
        "internal",
        { limit?: number; offset?: number },
        any,
        Name
      >;
      listChecks: FunctionReference<
        "action",
        "internal",
        { limit?: number; monitorId: string; offset?: number },
        any,
        Name
      >;
      remove: FunctionReference<
        "action",
        "internal",
        { monitorId: string },
        boolean,
        Name
      >;
      run: FunctionReference<
        "action",
        "internal",
        { monitorId: string },
        any,
        Name
      >;
      update: FunctionReference<
        "action",
        "internal",
        { monitorId: string; request: Record<string, any> },
        any,
        Name
      >;
    };
  };
