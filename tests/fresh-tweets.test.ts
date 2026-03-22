import { describe, expect, it } from "vitest";

import { getUnseenTweetRefs } from "@/lib/collector/fresh-tweets";

describe("fresh tweet selection", () => {
  const recentTweets = [
    { tweetId: "t3", tweetUrl: "", xUsername: "user", text: "", createdAt: null },
    { tweetId: "t2", tweetUrl: "", xUsername: "user", text: "", createdAt: null },
    { tweetId: "t1", tweetUrl: "", xUsername: "user", text: "", createdAt: null }
  ];

  it("returns only tweets newer than the last seen tweet", () => {
    expect(getUnseenTweetRefs(recentTweets, "t2").map((tweet) => tweet.tweetId)).toEqual(["t3"]);
  });

  it("returns all tweets when the last seen tweet is not in the current page", () => {
    expect(getUnseenTweetRefs(recentTweets, "older").map((tweet) => tweet.tweetId)).toEqual(["t3", "t2", "t1"]);
  });

  it("returns all tweets when there is no last seen tweet", () => {
    expect(getUnseenTweetRefs(recentTweets, null).map((tweet) => tweet.tweetId)).toEqual(["t3", "t2", "t1"]);
  });
});
