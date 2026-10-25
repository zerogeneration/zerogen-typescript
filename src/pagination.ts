export interface PageBody<Item> {
  data: Item[];
  nextCursor: string | null;
}

/** One page of a list. Iterate it with `for await` to read every page after it too. */
export class Page<Item> implements AsyncIterable<Item> {
  readonly data: Item[];
  /** The cursor for the next page, or null on the last page. */
  readonly nextCursor: string | null;
  readonly #load: (cursor: string) => Promise<Page<Item>>;

  constructor(body: PageBody<Item>, load: (cursor: string) => Promise<Page<Item>>) {
    this.data = body.data;
    this.nextCursor = body.nextCursor;
    this.#load = load;
  }

  hasNextPage(): boolean {
    return this.nextCursor !== null;
  }

  getNextPage(): Promise<Page<Item>> {
    if (this.nextCursor === null) return Promise.reject(new Error("This is the last page."));
    return this.#load(this.nextCursor);
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Item> {
    let page: Page<Item> = this;
    for (;;) {
      yield* page.data;
      if (!page.hasNextPage()) return;
      page = await page.getNextPage();
    }
  }
}

/**
 * A list request. Await it for the first page, or iterate it with
 * `for await` for every item on every page.
 */
export class PagePromise<Item> implements PromiseLike<Page<Item>>, AsyncIterable<Item> {
  readonly #load: () => Promise<Page<Item>>;
  #first: Promise<Page<Item>> | undefined;

  constructor(load: () => Promise<Page<Item>>) {
    this.#load = load;
  }

  // biome-ignore lint/suspicious/noThenProperty: a PagePromise is awaitable by design.
  then<Fulfilled = Page<Item>, Rejected = never>(
    onfulfilled?: ((page: Page<Item>) => Fulfilled | PromiseLike<Fulfilled>) | null,
    onrejected?: ((reason: unknown) => Rejected | PromiseLike<Rejected>) | null,
  ): Promise<Fulfilled | Rejected> {
    this.#first ??= this.#load();
    return this.#first.then(onfulfilled, onrejected);
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Item> {
    yield* await this;
  }
}
