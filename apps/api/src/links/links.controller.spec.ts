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
    findOne: jest.fn(),
    update: jest.fn(),
    archive: jest.fn(),
    unarchive: jest.fn(),
    remove: jest.fn(),
    removeAllArchived: jest.fn(),
  } as unknown as LinksService;

  const makeRequest = (userId = USER_ID) => ({ user: { userId } }) as never;
  const makeLink = (overrides = {}) => ({
    archivedAt: null,
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
    it('passes search and archived flag parsed from query strings', async () => {
      const paginated = { data: [], limit: 50, page: 1, total: 0 };
      (linksServiceMock.findAll as jest.Mock).mockResolvedValue(paginated);

      await controller.findAll(makeRequest(), 'duck', 'true', '2', '25');

      expect(linksServiceMock.findAll).toHaveBeenCalledWith(USER_ID, {
        archived: true,
        limit: 25,
        page: 2,
        search: 'duck',
      });
    });

    it('passes undefined for archived when the query param is absent', async () => {
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
        archived: undefined,
        limit: undefined,
        page: undefined,
        search: undefined,
      });
    });
  });

  describe('random', () => {
    it('passes archived=false by default', async () => {
      (linksServiceMock.getRandom as jest.Mock).mockResolvedValue(null);

      await controller.random(makeRequest(), undefined);

      expect(linksServiceMock.getRandom).toHaveBeenCalledWith(USER_ID, false);
    });

    it('passes archived=true when query param is "true"', async () => {
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

  describe('archive', () => {
    it('delegates to LinksService.archive', async () => {
      const link = makeLink({ archivedAt: new Date() });
      (linksServiceMock.archive as jest.Mock).mockResolvedValue(link);

      const result = await controller.archive(makeRequest(), LINK_ID);

      expect(linksServiceMock.archive).toHaveBeenCalledWith(USER_ID, LINK_ID);
      expect(result).toBe(link);
    });
  });

  describe('unarchive', () => {
    it('delegates to LinksService.unarchive', async () => {
      const link = makeLink();
      (linksServiceMock.unarchive as jest.Mock).mockResolvedValue(link);

      const result = await controller.unarchive(makeRequest(), LINK_ID);

      expect(linksServiceMock.unarchive).toHaveBeenCalledWith(USER_ID, LINK_ID);
      expect(result).toBe(link);
    });
  });

  describe('removeAllArchived', () => {
    it('delegates to LinksService.removeAllArchived', async () => {
      (linksServiceMock.removeAllArchived as jest.Mock).mockResolvedValue({
        count: 5,
      });

      const result = await controller.removeAllArchived(makeRequest());

      expect(linksServiceMock.removeAllArchived).toHaveBeenCalledWith(USER_ID);
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
