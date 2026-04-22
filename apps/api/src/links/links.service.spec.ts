import { jest } from '@jest/globals';

// avoids the need for a real database
class MockPrismaClientKnownRequestError extends Error {
  code: string;
  constructor(message: string, { code }: { code: string }) {
    super(message);
    this.code = code;
  }
}

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../prisma/generated/client', () => ({
  Prisma: { PrismaClientKnownRequestError: MockPrismaClientKnownRequestError },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LinksService } from './links.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { QUEUES } from '../queue/queue.constants';
import { Prisma } from '../prisma/generated/client';

const INVALID_LINK_URL = 'Hello, world!';
const JOB_ID = 'job-1';
const LINK_HOST = 'example.com';
const LINK_ID = 'link-1';
const LINK_TITLE = 'Example';
const LINK_URL = 'https://example.com/page';
const MISSING_LINK_ID = 'missing-link';
const UPDATED_LINK_TITLE = 'Example Update';
const USER_ID = 'user-1';

const makeLink = (overrides = {}) => ({
  archivedAt: null,
  createdAt: new Date(),
  host: LINK_HOST,
  id: LINK_ID,
  metaDescription: null,
  metaFetchedAt: null,
  metaImage: null,
  notes: null,
  title: LINK_TITLE,
  updatedAt: new Date(),
  url: LINK_URL,
  userId: USER_ID,
  ...overrides,
});

const makeP2025 = () =>
  new (
    Prisma as {
      PrismaClientKnownRequestError: typeof MockPrismaClientKnownRequestError;
    }
  ).PrismaClientKnownRequestError('Record not found', { code: 'P2025' });

describe('LinksService', () => {
  let service: LinksService;

  const queueMock = {
    send: jest.fn().mockResolvedValue(JOB_ID),
  } as unknown as QueueService;

  const prismaMock = {
    link: {
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinksService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: QueueService, useValue: queueMock },
      ],
    }).compile();

    service = module.get<LinksService>(LinksService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('parses host from url on create', async () => {
    (prismaMock.link.create as jest.Mock).mockResolvedValue(
      makeLink({
        host: LINK_HOST,
        id: LINK_ID,
        url: LINK_URL,
      }),
    );

    const link = await service.create(USER_ID, {
      title: LINK_TITLE,
      url: LINK_URL,
    });

    expect(prismaMock.link.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ host: LINK_HOST }),
      }),
    );
    expect(link.host).toBe(LINK_HOST);
    expect(queueMock.send).toHaveBeenCalledWith(QUEUES.METADATA_FETCH, {
      linkId: LINK_ID,
      url: LINK_URL,
    });
  });

  it('throws on invalid url', async () => {
    await expect(
      service.create(USER_ID, { url: INVALID_LINK_URL }),
    ).rejects.toThrow('Invalid url');
  });

  it('findAll returns paginated results with defaults', async () => {
    (prismaMock.link.findMany as jest.Mock).mockResolvedValue([makeLink()]);
    (prismaMock.link.count as jest.Mock).mockResolvedValue(1);

    const result = await service.findAll(USER_ID, {});

    expect(prismaMock.link.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        skip: 0,
        take: 50,
      }),
    );
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
  });

  it('findAll filters archived links when archived=true', async () => {
    (prismaMock.link.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.link.count as jest.Mock).mockResolvedValue(0);

    await service.findAll(USER_ID, { archived: true });

    expect(prismaMock.link.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ archivedAt: { not: null } }),
      }),
    );
  });

  it('findAll adds OR search conditions when search is provided', async () => {
    (prismaMock.link.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.link.count as jest.Mock).mockResolvedValue(0);

    await service.findAll(USER_ID, { search: 'duck' });

    expect(prismaMock.link.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    );
  });

  it('findOne returns link when found', async () => {
    const link = makeLink();
    (prismaMock.link.findFirst as jest.Mock).mockResolvedValue(link);

    const result = await service.findOne(USER_ID, LINK_ID);
    expect(result).toBe(link);
  });

  it('findOne throws NotFoundException when link is not found', async () => {
    (prismaMock.link.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.findOne(USER_ID, MISSING_LINK_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('update returns updated link', async () => {
    const link = makeLink({
      title: UPDATED_LINK_TITLE,
    });
    (prismaMock.link.update as jest.Mock).mockResolvedValue(link);

    const result = await service.update(USER_ID, LINK_ID, {
      title: UPDATED_LINK_TITLE,
    });

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: LINK_ID,
          userId: USER_ID,
        },
      }),
    );
    expect(result?.title).toBe(UPDATED_LINK_TITLE);
  });

  it('update throws NotFoundException on P2025', async () => {
    (prismaMock.link.update as jest.Mock).mockRejectedValue(makeP2025());

    await expect(service.update(USER_ID, MISSING_LINK_ID, {})).rejects.toThrow(
      NotFoundException,
    );
  });

  it('archive sets archivedAt and returns link', async () => {
    const archived = makeLink({ archivedAt: new Date() });
    (prismaMock.link.update as jest.Mock).mockResolvedValue(archived);

    const result = await service.archive(USER_ID, LINK_ID);
    expect(result?.archivedAt).not.toBeNull();
  });

  it('archive throws NotFoundException on P2025', async () => {
    (prismaMock.link.update as jest.Mock).mockRejectedValue(makeP2025());

    await expect(service.archive(USER_ID, MISSING_LINK_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('unarchive clears archivedAt and returns link', async () => {
    const unarchived = makeLink({ archivedAt: null });
    (prismaMock.link.update as jest.Mock).mockResolvedValue(unarchived);

    const result = await service.unarchive(USER_ID, LINK_ID);
    expect(result?.archivedAt).toBeNull();
  });

  it('unarchive throws NotFoundException on P2025', async () => {
    (prismaMock.link.update as jest.Mock).mockRejectedValue(makeP2025());

    await expect(service.unarchive(USER_ID, MISSING_LINK_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('remove returns { success: true }', async () => {
    (prismaMock.link.delete as jest.Mock).mockResolvedValue(undefined);

    const result = await service.remove(USER_ID, LINK_ID);

    expect(prismaMock.link.delete).toHaveBeenCalledWith({
      where: {
        id: LINK_ID,
        userId: USER_ID,
      },
    });
    expect(result).toEqual({ success: true });
  });

  it('remove throws NotFoundException on P2025', async () => {
    (prismaMock.link.delete as jest.Mock).mockRejectedValue(makeP2025());

    await expect(service.remove(USER_ID, MISSING_LINK_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getRandom returns null when there are no links', async () => {
    (prismaMock.link.count as jest.Mock).mockResolvedValue(0);

    const result = await service.getRandom(USER_ID);

    expect(result).toBeNull();
    expect(prismaMock.link.findMany).not.toHaveBeenCalled();
  });

  it('getRandom returns a link when links exist', async () => {
    const link = makeLink();
    (prismaMock.link.count as jest.Mock).mockResolvedValue(3);
    (prismaMock.link.findMany as jest.Mock).mockResolvedValue([link]);

    const result = await service.getRandom(USER_ID);

    expect(result).toBe(link);
    expect(prismaMock.link.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
  });
});
