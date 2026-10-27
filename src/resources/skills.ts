import type { RequestOptions, ZeroGen } from "../client.js";
import type { PagePromise } from "../pagination.js";
import type { Skill, SkillDetail, SkillGetQuery, SkillListQuery } from "../types.js";

export class Skills {
  readonly #client: ZeroGen;

  constructor(client: ZeroGen) {
    this.#client = client;
  }

  /**
   * Lists the key owner's personal and organization skills, plus `projectId`'s
   * shared skills, without their instructions.
   */
  list(query: SkillListQuery = {}, options?: RequestOptions): PagePromise<Skill> {
    return this.#client.list({ method: "GET", path: "/skills", query }, options);
  }

  /** Reads a skill's latest instructions. A project's shared skill needs that `projectId`. */
  get(skillId: string, query: SkillGetQuery = {}, options?: RequestOptions): Promise<SkillDetail> {
    return this.#client.request(
      { method: "GET", path: `/skills/${encodeURIComponent(skillId)}`, query },
      options,
    );
  }
}
