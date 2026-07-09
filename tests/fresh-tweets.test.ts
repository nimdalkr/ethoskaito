import { describe, expect, it } from "vitest";

import { compareTweetIds, getMaxTweetId, getUnseenTweetRefs } from "@/lib/collector/fresh-tweets";

describe("fresh tweet selection", () => {
  const recentTweets = [
    { tweetId: "300", tweetUrl: "", xUsername: "user", text: "", createdAt: null },
    { tweetId: "200", tweetUrl: "", xUsername: "user", text: "", createdAt: null },
    { tweetId: "100", tweetUrl: "", xUsername: "user", text: "", createdAt: null }
  ];

  it("returns only tweets with id greater than last seen snowflake", () => {
    expect(getUnseenTweetRefs(recentTweets, "200").map((tweet) => tweet.tweetId)).toEqual(["300"]);
  });

  it("returns all tweets newer than cursor even when list order is scrambled", () => {
    const scrambled = [
      { tweetId: "100", tweetUrl: "", xUsername: "user", text: "", createdAt: null },
      { tweetId: "300", tweetUrl: "", xUsername: "user", text: "", createdAt: null },
      { tweetId: "200", tweetUrl: "", xUsername: "user", text: "", createdAt: null }
    ];
    expect(getUnseenTweetRefs(scrambled, "150").map((tweet) => tweet.tweetId)).toEqual(["300", "200"]);
  });

  it("returns all tweets when the last seen tweet is not in the current page", () => {
    expect(getUnseenTweetRefs(recentTweets, "50").map((tweet) => tweet.tweetId)).toEqual(["300", "200", "100"]);
  });

  it("returns all tweets when there is no last seen tweet", () => {
    expect(getUnseenTweetRefs(recentTweets, null).map((tweet) => tweet.tweetId)).toEqual(["300", "200", "100"]);
  });

  it("picks the max snowflake id as the high-water mark", () => {
    expect(getMaxTweetId(["100", "300", "200"])).toBe("300");
    expect(getMaxTweetId([null, "9", "10"])).toBe("10");
    expect(getMaxTweetId([])).toBeNull();
  });

  it("compares large snowflake ids safely", () => {
    expect(compareTweetIds("1901234567890123456", "1901234567890123455")).toBe(1);
    expect(compareTweetIds("100", "100")).toBe(0);
  });
});
