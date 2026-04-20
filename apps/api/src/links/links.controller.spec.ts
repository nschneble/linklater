import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';

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
  } as unknown as LinksService;

  const makeReq = (userId = 'user-1') => ({ user: { userId } } as never);
  const makeLink = (overrides = {}) => ({
    id: 'link-1',
    userId: 'user-1',
    url: 'https://example.com',
    title: 'Example',
    host: 'example.com',
    notes: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
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

      const result = await controller.create(makeReq(), { url: 'https://example.com' } as never);

      expect(linksServiceMock.create).toHaveBeenCalledWith('user-1', { url: 'https://example.com' });
      expect(result).toBe(link);
    });
  });

  describe('findAll', () => {
    it('passes search and archived flag parsed from query strings', async () => {
      const paginated = { data: [], total: 0, page: 1, limit: 50 };
      (linksServiceMock.findAll as jest.Mock).mockResolvedValue(paginated);

      await controller.findAll(makeReq(), 'term', 'true', '2', '25');

      expect(linksServiceMock.findAll).toHaveBeenCalledWith('user-1', {
        search: 'term',
        archived: true,
        page: 2,
        limit: 25,
      });
    });

    it('passes undefined for archived when the query param is absent', async () => {
      (linksServiceMock.findAll as jest.Mock).mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 });

      await controller.findAll(makeReq(), undefined, undefined, undefined, undefined);

      expect(linksServiceMock.findAll).toHaveBeenCalledWith('user-1', {
        search: undefined,
        archived: undefined,
        page: undefined,
        limit: undefined,
      });
    });
  });

  describe('random', () => {
    it('passes archived=false by default', async () => {
      (linksServiceMock.getRandom as jest.Mock).mockResolvedValue(null);

      await controller.random(makeReq(), undefined);

      expect(linksServiceMock.getRandom).toHaveBeenCalledWith('user-1', false);
    });

    it('passes archived=true when query param is "true"', async () => {
      (linksServiceMock.getRandom as jest.Mock).mockResolvedValue(null);

      await controller.random(makeReq(), 'true');

      expect(linksServiceMock.getRandom).toHaveBeenCalledWith('user-1', true);
    });

    it('wraps result in { link }', async () => {
      const link = makeLink();
      (linksServiceMock.getRandom as jest.Mock).mockResolvedValue(link);

      const result = await controller.random(makeReq(), undefined);

      expect(result).toEqual({ link });
    });
  });

  describe('findOne', () => {
    it('delegates to LinksService.findOne', async () => {
      const link = makeLink();
      (linksServiceMock.findOne as jest.Mock).mockResolvedValue(link);

      const result = await controller.findOne(makeReq(), 'link-1');

      expect(linksServiceMock.findOne).toHaveBeenCalledWith('user-1', 'link-1');
      expect(result).toBe(link);
    });
  });

  describe('update', () => {
    it('delegates to LinksService.update', async () => {
      const link = makeLink({ title: 'Updated' });
      (linksServiceMock.update as jest.Mock).mockResolvedValue(link);

      const result = await controller.update(makeReq(), 'link-1', { title: 'Updated' } as never);

      expect(linksServiceMock.update).toHaveBeenCalledWith('user-1', 'link-1', { title: 'Updated' });
      expect(result).toBe(link);
    });
  });

  describe('archive', () => {
    it('delegates to LinksService.archive', async () => {
      const link = makeLink({ archivedAt: new Date() });
      (linksServiceMock.archive as jest.Mock).mockResolvedValue(link);

      const result = await controller.archive(makeReq(), 'link-1');

      expect(linksServiceMock.archive).toHaveBeenCalledWith('user-1', 'link-1');
      expect(result).toBe(link);
    });
  });

  describe('unarchive', () => {
    it('delegates to LinksService.unarchive', async () => {
      const link = makeLink();
      (linksServiceMock.unarchive as jest.Mock).mockResolvedValue(link);

      const result = await controller.unarchive(makeReq(), 'link-1');

      expect(linksServiceMock.unarchive).toHaveBeenCalledWith('user-1', 'link-1');
      expect(result).toBe(link);
    });
  });

  describe('remove', () => {
    it('delegates to LinksService.remove', async () => {
      (linksServiceMock.remove as jest.Mock).mockResolvedValue({ success: true });

      const result = await controller.remove(makeReq(), 'link-1');

      expect(linksServiceMock.remove).toHaveBeenCalledWith('user-1', 'link-1');
      expect(result).toEqual({ success: true });
    });
  });
});
