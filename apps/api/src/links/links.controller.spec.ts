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
        // AnyAuthGuard (applied at the controller level) pulls in
        // TokenScopeService, which depends on the throttler storage; a stub
        // keeps this controller unit test from booting that whole graph.
        { provide: TokenScopeService, useValue: { enforce: jest.fn() } },
      ],
    })
      // The route-level CustomThrottlerGuard on `create` needs the whole
      // ThrottlerModule graph; override it so this unit test does not boot it.
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

    it('passes the created-vs-resurfaced status through unchanged', async () => {
      const resurfaced = makeLink({ status: 'resurfaced' });
      (linksServiceMock.create as jest.Mock).mockResolvedValue(resurfaced);

      const result = await controller.create(makeRequest(), {
        url: LINK_URL,
      } as never);

      expect(result).toBe(resurfaced);
      expect(result.status).toBe('resurfaced');
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

    it('passes search and read flag parsed from query strings', async () => {
      const paginated = { data: [], limit: 50, page: 1, total: 0 };
      (linksQueryMock.findAll as jest.Mock).mockResolvedValue(paginated);

      await controller.findAll(makeRequest(), 'duck', 'true', '2', '25');

      expect(linksQueryMock.findAll).toHaveBeenCalledWith(USER_ID, {
        read: true,
        limit: 25,
        page: 2,
        search: 'duck',
      });
    });

    it('passes read=false when the query param is "false"', async () => {
      (linksQueryMock.findAll as jest.Mock).mockResolvedValue({
        data: [],
        limit: 50,
        page: 1,
        total: 0,
      });

      await controller.findAll(
        makeRequest(),
        undefined,
        'false',
        undefined,
        undefined,
      );

      expect(linksQueryMock.findAll).toHaveBeenCalledWith(USER_ID, {
        read: false,
        limit: undefined,
        page: undefined,
        search: undefined,
      });
    });

    it('passes undefined for read when the query param is absent', async () => {
      (linksQueryMock.findAll as jest.Mock).mockResolvedValue({
        data: [],
        limit: 50,
        page: 1,
        total: 0,
      });

      await controller.findAll(
        makeRequest(),
        undefined,
        undefined,
        undefined,
        undefined,
      );

      expect(linksQueryMock.findAll).toHaveBeenCalledWith(USER_ID, {
        read: undefined,
        limit: undefined,
        page: undefined,
        search: undefined,
      });
    });
  });

  describe('random', () => {
    it('passes read=false by default', async () => {
      (linksQueryMock.getRandom as jest.Mock).mockResolvedValue(null);

      await controller.random(makeRequest(), undefined);

      expect(linksQueryMock.getRandom).toHaveBeenCalledWith(USER_ID, false);
    });

    it('passes read=true when query param is "true"', async () => {
      (linksQueryMock.getRandom as jest.Mock).mockResolvedValue(null);

      await controller.random(makeRequest(), 'true');

      expect(linksQueryMock.getRandom).toHaveBeenCalledWith(USER_ID, true);
    });

    it('wraps result in { link }', async () => {
      const link = makeLink();
      (linksQueryMock.getRandom as jest.Mock).mockResolvedValue(link);

      const result = await controller.random(makeRequest(), undefined);

      expect(result).toEqual({ link });
    });

    it('passes read=false when the query param is any value other than "true"', async () => {
      (linksQueryMock.getRandom as jest.Mock).mockResolvedValue(null);

      await controller.random(makeRequest(), 'false');

      expect(linksQueryMock.getRandom).toHaveBeenCalledWith(USER_ID, false);
    });

    it('returns { link: null } when no link matches', async () => {
      (linksQueryMock.getRandom as jest.Mock).mockResolvedValue(null);

      const result = await controller.random(makeRequest(), undefined);

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

  describe('findOne', () => {
    it('delegates to LinksQueryService.findOne', async () => {
      const link = makeLink();
      (linksQueryMock.findOne as jest.Mock).mockResolvedValue(link);

      const result = await controller.findOne(makeRequest(), LINK_ID);

      expect(linksQueryMock.findOne).toHaveBeenCalledWith(USER_ID, LINK_ID);
      expect(result).toBe(link);
    });
  });

  describe('read', () => {
    it('delegates to LinksService.read', async () => {
      const link = makeLink({ readAt: new Date() });
      (linksServiceMock.read as jest.Mock).mockResolvedValue(link);

      const result = await controller.read(makeRequest(), LINK_ID);

      expect(linksServiceMock.read).toHaveBeenCalledWith(USER_ID, LINK_ID);
      expect(result).toBe(link);
    });
  });

  describe('unread', () => {
    it('delegates to LinksService.unread', async () => {
      const link = makeLink();
      (linksServiceMock.unread as jest.Mock).mockResolvedValue(link);

      const result = await controller.unread(makeRequest(), LINK_ID);

      expect(linksServiceMock.unread).toHaveBeenCalledWith(USER_ID, LINK_ID);
      expect(result).toBe(link);
    });
  });

  describe('removeAllRead', () => {
    it('delegates to LinksService.removeAllRead', async () => {
      (linksServiceMock.removeAllRead as jest.Mock).mockResolvedValue({
        count: 5,
      });

      const result = await controller.removeAllRead(makeRequest());

      expect(linksServiceMock.removeAllRead).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ count: 5 });
    });
  });

  describe('remove', () => {
    it('delegates to LinksService.remove', async () => {
      (linksServiceMock.remove as jest.Mock).mockResolvedValue({
        success: true,
      });

      const result = await controller.remove(makeRequest(), LINK_ID);

      expect(linksServiceMock.remove).toHaveBeenCalledWith(USER_ID, LINK_ID);
      expect(result).toEqual({ success: true });
    });
  });
});
