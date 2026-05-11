import { jest } from '@jest/globals';

import { LinksController } from './links.controller';
import { LinksService } from './links.service';
import { Test, TestingModule } from '@nestjs/testing';

const LINK_ID = 'link-1';
const LINK_URL = 'https://example.com/page';
const USER_ID = 'user-1';

describe('LinksController', () => {
  let controller: LinksController;

  const linksServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    getRandom: jest.fn(),
    stumble: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    read: jest.fn(),
    unread: jest.fn(),
    remove: jest.fn(),
    removeAllRead: jest.fn(),
  } as unknown as LinksService;

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
      providers: [{ provide: LinksService, useValue: linksServiceMock }],
    }).compile();

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
  });

  describe('findAll', () => {
    it('passes search and read flag parsed from query strings', async () => {
      const paginated = { data: [], limit: 50, page: 1, total: 0 };
      (linksServiceMock.findAll as jest.Mock).mockResolvedValue(paginated);

      await controller.findAll(makeRequest(), 'duck', 'true', '2', '25');

      expect(linksServiceMock.findAll).toHaveBeenCalledWith(USER_ID, {
        read: true,
        limit: 25,
        page: 2,
        search: 'duck',
      });
    });

    it('passes read=false when the query param is "false"', async () => {
      (linksServiceMock.findAll as jest.Mock).mockResolvedValue({
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

      expect(linksServiceMock.findAll).toHaveBeenCalledWith(USER_ID, {
        read: false,
        limit: undefined,
        page: undefined,
        search: undefined,
      });
    });

    it('passes undefined for read when the query param is absent', async () => {
      (linksServiceMock.findAll as jest.Mock).mockResolvedValue({
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

      expect(linksServiceMock.findAll).toHaveBeenCalledWith(USER_ID, {
        read: undefined,
        limit: undefined,
        page: undefined,
        search: undefined,
      });
    });
  });

  describe('random', () => {
    it('passes read=false by default', async () => {
      (linksServiceMock.getRandom as jest.Mock).mockResolvedValue(null);

      await controller.random(makeRequest(), undefined);

      expect(linksServiceMock.getRandom).toHaveBeenCalledWith(USER_ID, false);
    });

    it('passes read=true when query param is "true"', async () => {
      (linksServiceMock.getRandom as jest.Mock).mockResolvedValue(null);

      await controller.random(makeRequest(), 'true');

      expect(linksServiceMock.getRandom).toHaveBeenCalledWith(USER_ID, true);
    });

    it('wraps result in { link }', async () => {
      const link = makeLink();
      (linksServiceMock.getRandom as jest.Mock).mockResolvedValue(link);

      const result = await controller.random(makeRequest(), undefined);

      expect(result).toEqual({ link });
    });
  });

  describe('stumble', () => {
    it('returns { url } when an unread link is found', async () => {
      (linksServiceMock.stumble as jest.Mock).mockResolvedValue({
        url: LINK_URL,
      });

      const result = await controller.stumble(makeRequest());

      expect(linksServiceMock.stumble).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ url: LINK_URL });
    });

    it('returns { url: null } when no unread links exist', async () => {
      (linksServiceMock.stumble as jest.Mock).mockResolvedValue(null);

      const result = await controller.stumble(makeRequest());

      expect(result).toEqual({ url: null });
    });
  });

  describe('findOne', () => {
    it('delegates to LinksService.findOne', async () => {
      const link = makeLink();
      (linksServiceMock.findOne as jest.Mock).mockResolvedValue(link);

      const result = await controller.findOne(makeRequest(), LINK_ID);

      expect(linksServiceMock.findOne).toHaveBeenCalledWith(USER_ID, LINK_ID);
      expect(result).toBe(link);
    });
  });

  describe('update', () => {
    it('delegates to LinksService.update', async () => {
      const link = makeLink();
      (linksServiceMock.update as jest.Mock).mockResolvedValue(link);

      const result = await controller.update(
        makeRequest(),
        LINK_ID,
        {} as never,
      );

      expect(linksServiceMock.update).toHaveBeenCalledWith(
        USER_ID,
        LINK_ID,
        {},
      );
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
