import { jest } from '@jest/globals';

import { CustomThrottlerGuard } from '../auth/custom-throttler.guard';
import { LinksController } from './links.controller';
import { LinksQueryService } from './links-query.service';
import { LinksService } from './links.service';
import { Test, type TestingModule } from '@nestjs/testing';
import { TokenScopeService } from '../auth/token-scope.service';

const LINK_ID = 'link-1';
const LINK_URL = 'https://example.com/page';
const USER_ID = 'user-1';

describe('LinksController', () => {
  let controller: LinksController;

  const linksServiceMock = {
    create: jest.fn(),
    read: jest.fn(),
    unread: jest.fn(),
    remove: jest.fn(),
    removeAllRead: jest.fn(),
  } as unknown as LinksService;

  const linksQueryMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    getRandom: jest.fn(),
    stumble: jest.fn(),
  } as unknown as LinksQueryService;

  const makeRequest = (userId = USER_ID) => ({ user: { userId } }) as never;
  const makeLink = (overrides = {}) => ({
    readAt: null,
    createdAt: new Date(),
    id: LINK_ID,
    meta: null,
    updatedAt: new Date(),
    url: LINK_URL,
    userId: USER_ID,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LinksController],
      providers: [
        { provide: LinksService, useValue: linksServiceMock },
        { provide: LinksQueryService, useValue: linksQueryMock },
        // AnyAuthGuard needs TokenScopeService; stub avoids booting it
        { provide: TokenScopeService, useValue: { enforce: jest.fn() } },
      ],
    })
      // CustomThrottlerGuard needs the ThrottlerModule graph; override it
      .overrideGuard(CustomThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<LinksController>(LinksController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('delegates to LinksService.create with userId', async () => {
      const link = makeLink();
      (linksServiceMock.create as jest.Mock).mockResolvedValue(link);

      const result = await controller.create(makeRequest(), {
        url: LINK_URL,
      } as never);

      expect(linksServiceMock.create).toHaveBeenCalledWith(USER_ID, {
        url: LINK_URL,
      });
      expect(result).toBe(link);
    });

    it('applies CustomThrottlerGuard to cap link-creation spam', () => {
      const guards: unknown[] =
        Reflect.getMetadata('__guards__', LinksController.prototype.create) ??
        [];
      expect(guards).toContain(CustomThrottlerGuard);
    });

    it('overrides the default bucket with 60 requests per minute', () => {
      const ttl = Reflect.getMetadata(
        'THROTTLER:TTLdefault',
        LinksController.prototype.create,
      );
      const limit = Reflect.getMetadata(
        'THROTTLER:LIMITdefault',
        LinksController.prototype.create,
      );
      expect(ttl).toBe(60000);
      expect(limit).toBe(60);
    });
  });

  describe('findAll', () => {
    it('is not throttled (reads should not consume the create limit)', () => {
      const guards: unknown[] =
        Reflect.getMetadata('__guards__', LinksController.prototype.findAll) ??
        [];
      const ttl = Reflect.getMetadata(
        'THROTTLER:TTLdefault',
        LinksController.prototype.findAll,
      );
      expect(guards).not.toContain(CustomThrottlerGuard);
      expect(ttl).toBeUndefined();
    });

    // query parsing lives in ListLinksQueryDto; this proves forwarding
    it('forwards the validated query DTO to LinksQueryService.findAll', async () => {
      const paginated = { data: [], limit: 25, page: 2, total: 0 };
      (linksQueryMock.findAll as jest.Mock).mockResolvedValue(paginated);

      const query = { search: 'duck', read: true, page: 2, limit: 25 };
      const result = await controller.findAll(makeRequest(), query as never);

      expect(linksQueryMock.findAll).toHaveBeenCalledWith(USER_ID, query);
      expect(result).toBe(paginated);
    });

    it('forwards read=false straight through', async () => {
      (linksQueryMock.findAll as jest.Mock).mockResolvedValue({
        data: [],
        limit: 50,
        page: 1,
        total: 0,
      });

      await controller.findAll(makeRequest(), { read: false } as never);

      expect(linksQueryMock.findAll).toHaveBeenCalledWith(USER_ID, {
        read: false,
      });
    });

    it('forwards an empty query so the service applies its own defaults', async () => {
      (linksQueryMock.findAll as jest.Mock).mockResolvedValue({
        data: [],
        limit: 10,
        page: 1,
        total: 0,
      });

      const query = {};
      await controller.findAll(makeRequest(), query as never);

      expect(linksQueryMock.findAll).toHaveBeenCalledWith(USER_ID, query);
    });
  });

  describe('random', () => {
    // `read` omitted stays undefined; getRandom defaults to unread
    it('forwards undefined read so the service defaults to unread', async () => {
      (linksQueryMock.getRandom as jest.Mock).mockResolvedValue(null);

      await controller.random(makeRequest(), {} as never);

      expect(linksQueryMock.getRandom).toHaveBeenCalledWith(USER_ID, undefined);
    });

    it('forwards read=true through to the service', async () => {
      (linksQueryMock.getRandom as jest.Mock).mockResolvedValue(null);

      await controller.random(makeRequest(), { read: true } as never);

      expect(linksQueryMock.getRandom).toHaveBeenCalledWith(USER_ID, true);
    });

    it('forwards read=false through to the service', async () => {
      (linksQueryMock.getRandom as jest.Mock).mockResolvedValue(null);

      await controller.random(makeRequest(), { read: false } as never);

      expect(linksQueryMock.getRandom).toHaveBeenCalledWith(USER_ID, false);
    });

    it('wraps result in { link }', async () => {
      const link = makeLink();
      (linksQueryMock.getRandom as jest.Mock).mockResolvedValue(link);

      const result = await controller.random(makeRequest(), {} as never);

      expect(result).toEqual({ link });
    });

    it('returns { link: null } when no link matches', async () => {
      (linksQueryMock.getRandom as jest.Mock).mockResolvedValue(null);

      const result = await controller.random(makeRequest(), {} as never);

      expect(result).toEqual({ link: null });
    });
  });

  describe('stumble', () => {
    it('returns { url } when an unread link is found', async () => {
      (linksQueryMock.stumble as jest.Mock).mockResolvedValue({
        url: LINK_URL,
      });

      const result = await controller.stumble(makeRequest());

      expect(linksQueryMock.stumble).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ url: LINK_URL });
    });

    it('returns { url: null } when no unread links exist', async () => {
      (linksQueryMock.stumble as jest.Mock).mockResolvedValue(null);

      const result = await controller.stumble(makeRequest());

      expect(result).toEqual({ url: null });
    });
  });

  describe('remove', () => {
    // (userId, id) are same-typed; one test guards order tsc can't catch
    it('delegates to LinksService.remove with userId then id', async () => {
      const deleted = { id: LINK_ID };
      (linksServiceMock.remove as jest.Mock).mockResolvedValue(deleted);

      const result = await controller.remove(makeRequest(), LINK_ID);

      expect(linksServiceMock.remove).toHaveBeenCalledWith(USER_ID, LINK_ID);
      expect(result).toBe(deleted);
    });
  });
});
