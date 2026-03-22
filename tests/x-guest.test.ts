import { describe, expect, it } from "vitest";

import { extractMainBundleUrl, extractPublicBearerToken, extractQueryId, extractTimelineTweetRefs } from "@/lib/providers/x-guest";

describe("x guest provider helpers", () => {
  it("extracts the main bundle url from x html", () => {
    const html = `
      <html>
        <head>
          <script src="https://abs.twimg.com/responsive-web/client-web/vendor.123.js"></script>
          <script src="https://abs.twimg.com/responsive-web/client-web/main.64b6b5da.js"></script>
        </head>
      </html>
    `;

    expect(extractMainBundleUrl(html)).toBe("https://abs.twimg.com/responsive-web/client-web/main.64b6b5da.js");
  });

  it("extracts the public bearer token and graphql query ids from the bundle", () => {
    const bundle = `
      e.exports={queryId:"IGgvgiOx4QZndDHuD3x9TQ",operationName:"UserByScreenName"}
      e.exports={queryId:"O0epvwaQPUx-bT9YlqlL6w",operationName:"UserTweets"}
      Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA
    `;

    expect(extractPublicBearerToken(bundle)).toContain("AAAAAAAAAAAAAAAAAAAAANRILg");
    expect(extractQueryId(bundle, "UserByScreenName")).toBe("IGgvgiOx4QZndDHuD3x9TQ");
    expect(extractQueryId(bundle, "UserTweets")).toBe("O0epvwaQPUx-bT9YlqlL6w");
  });

  it("extracts only matching author tweets from the timeline payload", () => {
    const payload = {
      data: {
        user: {
          result: {
            timeline: {
              timeline: {
                instructions: [
                  {
                    entries: [
                      {
                        content: {
                          itemContent: {
                            tweet_results: {
                              result: {
                                rest_id: "1900000000000000001",
                                legacy: {
                                  created_at: "Wed Mar 19 00:00:00 +0000 2026",
                                  full_text: "Monad ships."
                                },
                                core: {
                                  user_results: {
                                    result: {
                                      core: {
                                        screen_name: "monad"
                                      }
                                    }
                                  }
                                },
                                quoted_status_result: {
                                  result: {
                                    rest_id: "1900000000000000999",
                                    legacy: {
                                      created_at: "Wed Mar 19 00:00:00 +0000 2026",
                                      full_text: "Quoted status should not be collected."
                                    },
                                    core: {
                                      user_results: {
                                        result: {
                                          core: {
                                            screen_name: "monad"
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      },
                      {
                        content: {
                          itemContent: {
                            tweet_results: {
                              result: {
                                rest_id: "1900000000000000002",
                                legacy: {
                                  created_at: "Tue Mar 18 00:00:00 +0000 2026",
                                  full_text: "Other account post."
                                },
                                core: {
                                  user_results: {
                                    result: {
                                      core: {
                                        screen_name: "someoneelse"
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    };

    expect(extractTimelineTweetRefs(payload, "monad")).toEqual([
      {
        tweetId: "1900000000000000001",
        tweetUrl: "https://x.com/monad/status/1900000000000000001",
        xUsername: "monad",
        text: "Monad ships.",
        createdAt: "2026-03-19T00:00:00.000Z"
      }
    ]);
  });
});
