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

  const makeRequest = (userId = 'E70BFB8A-CC9C-45A8-9B30-0BF3C4F72CCF') =>
    ({ user: { userId } }) as never;
  const makeLink = (overrides = {}) => ({
    id: '3046E089-DC27-4618-A0E9-A08B293729E0',
    userId: 'A3073906-6844-42A3-A3A1-3744584F0587',
    url: 'https://webawesome.com',
    title: 'Web Awesome',
    host: 'webawesome.com',
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

      const result = await controller.create(makeRequest(), {
        url: 'https://webawesome.com',
      } as never);

      expect(linksServiceMock.create).toHaveBeenCalledWith(
        'E70BFB8A-CC9C-45A8-9B30-0BF3C4F72CCF',
        {
          url: 'https://webawesome.com',
        },
      );
      expect(result).toBe(link);
    });
  });

  describe('findAll', () => {
    it('passes search and archived flag parsed from query strings', async () => {
      const paginated = { data: [], total: 0, page: 1, limit: 50 };
      (linksServiceMock.findAll as jest.Mock).mockResolvedValue(paginated);

      await controller.findAll(makeRequest(), 'term', 'true', '2', '25');

      expect(linksServiceMock.findAll).toHaveBeenCalledWith(
        'E70BFB8A-CC9C-45A8-9B30-0BF3C4F72CCF',
        {
          search: 'term',
          archived: true,
          page: 2,
          limit: 25,
        },
      );
    });

    it('passes undefined for archived when the query param is absent', async () => {
      (linksServiceMock.findAll as jest.Mock).mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
      });

      await controller.findAll(
        makeRequest(),
        undefined,
        undefined,
        undefined,
        undefined,
      );

      expect(linksServiceMock.findAll).toHaveBeenCalledWith(
        'E70BFB8A-CC9C-45A8-9B30-0BF3C4F72CCF',
        {
          search: undefined,
          archived: undefined,
          page: undefined,
          limit: undefined,
        },
      );
    });
  });

  describe('random', () => {
    it('passes archived=false by default', async () => {
      (linksServiceMock.getRandom as jest.Mock).mockResolvedValue(null);

      await controller.random(makeRequest(), undefined);

      expect(linksServiceMock.getRandom).toHaveBeenCalledWith(
        'E70BFB8A-CC9C-45A8-9B30-0BF3C4F72CCF',
        false,
      );
    });

    it('passes archived=true when query param is "true"', async () => {
      (linksServiceMock.getRandom as jest.Mock).mockResolvedValue(null);

      await controller.random(makeRequest(), 'true');

      expect(linksServiceMock.getRandom).toHaveBeenCalledWith(
        'E70BFB8A-CC9C-45A8-9B30-0BF3C4F72CCF',
        true,
      );
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

      const result = await controller.findOne(
        makeRequest(),
        '1CC1C58D-7B46-4311-8CF9-35566920DDAD',
      );

      expect(linksServiceMock.findOne).toHaveBeenCalledWith(
        'E70BFB8A-CC9C-45A8-9B30-0BF3C4F72CCF',
        '1CC1C58D-7B46-4311-8CF9-35566920DDAD',
      );
      expect(result).toBe(link);
    });
  });

  describe('update', () => {
    it('delegates to LinksService.update', async () => {
      const link = makeLink({ title: 'Slow Software Movement' });
      (linksServiceMock.update as jest.Mock).mockResolvedValue(link);

      const result = await controller.update(
        makeRequest(),
        '9111B773-FA82-413B-9510-6E032DB8721D',
        {
          title: 'Slow Software Movement',
        } as never,
      );

      expect(linksServiceMock.update).toHaveBeenCalledWith(
        'E70BFB8A-CC9C-45A8-9B30-0BF3C4F72CCF',
        '9111B773-FA82-413B-9510-6E032DB8721D',
        {
          title: 'Slow Software Movement',
        },
      );
      expect(result).toBe(link);
    });
  });

  describe('archive', () => {
    it('delegates to LinksService.archive', async () => {
      const link = makeLink({ archivedAt: new Date() });
      (linksServiceMock.archive as jest.Mock).mockResolvedValue(link);

      const result = await controller.archive(
        makeRequest(),
        '71F6449F-363A-4DB3-B54D-EC6BA8C8C868',
      );

      expect(linksServiceMock.archive).toHaveBeenCalledWith(
        'E70BFB8A-CC9C-45A8-9B30-0BF3C4F72CCF',
        '71F6449F-363A-4DB3-B54D-EC6BA8C8C868',
      );
      expect(result).toBe(link);
    });
  });

  describe('unarchive', () => {
    it('delegates to LinksService.unarchive', async () => {
      const link = makeLink();
      (linksServiceMock.unarchive as jest.Mock).mockResolvedValue(link);

      const result = await controller.unarchive(
        makeRequest(),
        'C15F2A28-08B1-4F58-9E48-A3C8FB4D019F',
      );

      expect(linksServiceMock.unarchive).toHaveBeenCalledWith(
        'E70BFB8A-CC9C-45A8-9B30-0BF3C4F72CCF',
        'C15F2A28-08B1-4F58-9E48-A3C8FB4D019F',
      );
      expect(result).toBe(link);
    });
  });

  describe('remove', () => {
    it('delegates to LinksService.remove', async () => {
      (linksServiceMock.remove as jest.Mock).mockResolvedValue({
        success: true,
      });

      const result = await controller.remove(
        makeRequest(),
        '224C219C-26B2-436A-A46D-418BE1A755A9',
      );

      expect(linksServiceMock.remove).toHaveBeenCalledWith(
        'E70BFB8A-CC9C-45A8-9B30-0BF3C4F72CCF',
        '224C219C-26B2-436A-A46D-418BE1A755A9',
      );
      expect(result).toEqual({ success: true });
    });
  });
});
