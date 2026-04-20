import { jest } from '@jest/globals';

// mock PrismaService and generated client so tests don't require a real database
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

// Provide a real-enough PrismaClientKnownRequestError so instanceof checks work in the service
class MockPrismaClientKnownRequestError extends Error {
  code: string;
  constructor(message: string, { code }: { code: string }) {
    super(message);
    this.code = code;
  }
}

jest.mock('../prisma/generated/client', () => ({
  Prisma: { PrismaClientKnownRequestError: MockPrismaClientKnownRequestError },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LinksService } from './links.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { QUEUES } from '../queue/queue.constants';
// Import Prisma from the mocked module so makeP2025 creates instances of the same class
// that the service's instanceof check uses
import { Prisma } from '../prisma/generated/client';

const makeLink = (overrides = {}) => ({
  id: 'link-1',
  userId: 'user1',
  url: 'https://example.com',
  title: 'Example',
  host: 'example.com',
  notes: null,
  archivedAt: null,
  metaDescription: null,
  metaImage: null,
  metaFetchedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
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
    send: jest.fn().mockResolvedValue('job-id'),
  } as unknown as QueueService;

  const prismaMock = {
    link: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
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

  // --- create ---

  it('parses host from URL on create', async () => {
    (prismaMock.link.create as jest.Mock).mockResolvedValue(
      makeLink({
        id: '1',
        url: 'https://example.com/path',
        host: 'example.com',
      }),
    );

    const link = await service.create('user1', {
      url: 'https://example.com/path',
      title: 'Example',
    });

    expect(prismaMock.link.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ host: 'example.com' }),
      }),
    );
    expect(link.host).toBe('example.com');
    expect(queueMock.send).toHaveBeenCalledWith(QUEUES.METADATA_FETCH, {
      linkId: '1',
      url: 'https://example.com/path',
    });
  });

  it('throws on invalid URL', async () => {
    await expect(service.create('user1', { url: 'not-a-url' })).rejects.toThrow(
      'Invalid URL',
    );
  });

  // --- findAll ---

  it('findAll returns paginated results with defaults', async () => {
    (prismaMock.link.findMany as jest.Mock).mockResolvedValue([makeLink()]);
    (prismaMock.link.count as jest.Mock).mockResolvedValue(1);

    const result = await service.findAll('user1', {});

    expect(prismaMock.link.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user1' },
        take: 50,
        skip: 0,
      }),
    );
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
  });

  it('findAll filters archived links when archived=true', async () => {
    (prismaMock.link.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.link.count as jest.Mock).mockResolvedValue(0);

    await service.findAll('user1', { archived: true });

    expect(prismaMock.link.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ archivedAt: { not: null } }),
      }),
    );
  });

  it('findAll adds OR search conditions when search is provided', async () => {
    (prismaMock.link.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.link.count as jest.Mock).mockResolvedValue(0);

    await service.findAll('user1', { search: 'hello' });

    expect(prismaMock.link.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    );
  });

  // --- findOne ---

  it('findOne returns link when found', async () => {
    const link = makeLink();
    (prismaMock.link.findFirst as jest.Mock).mockResolvedValue(link);

    const result = await service.findOne('user1', 'link-1');

    expect(result).toBe(link);
  });

  it('findOne throws NotFoundException when link is not found', async () => {
    (prismaMock.link.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.findOne('user1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  // --- update ---

  it('update returns updated link', async () => {
    const link = makeLink({ title: 'Updated' });
    (prismaMock.link.update as jest.Mock).mockResolvedValue(link);

    const result = await service.update('user1', 'link-1', {
      title: 'Updated',
    });

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'link-1', userId: 'user1' } }),
    );
    expect(result?.title).toBe('Updated');
  });

  it('update throws NotFoundException on P2025', async () => {
    (prismaMock.link.update as jest.Mock).mockRejectedValue(makeP2025());

    await expect(service.update('user1', 'missing', {})).rejects.toThrow(
      NotFoundException,
    );
  });

  // --- archive ---

  it('archive sets archivedAt and returns link', async () => {
    const archived = makeLink({ archivedAt: new Date() });
    (prismaMock.link.update as jest.Mock).mockResolvedValue(archived);

    const result = await service.archive('user1', 'link-1');

    expect(result?.archivedAt).not.toBeNull();
  });

  it('archive throws NotFoundException on P2025', async () => {
    (prismaMock.link.update as jest.Mock).mockRejectedValue(makeP2025());

    await expect(service.archive('user1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  // --- unarchive ---

  it('unarchive clears archivedAt and returns link', async () => {
    const unarchived = makeLink({ archivedAt: null });
    (prismaMock.link.update as jest.Mock).mockResolvedValue(unarchived);

    const result = await service.unarchive('user1', 'link-1');

    expect(result?.archivedAt).toBeNull();
  });

  it('unarchive throws NotFoundException on P2025', async () => {
    (prismaMock.link.update as jest.Mock).mockRejectedValue(makeP2025());

    await expect(service.unarchive('user1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  // --- remove ---

  it('remove returns { success: true }', async () => {
    (prismaMock.link.delete as jest.Mock).mockResolvedValue(undefined);

    const result = await service.remove('user1', 'link-1');

    expect(prismaMock.link.delete).toHaveBeenCalledWith({
      where: { id: 'link-1', userId: 'user1' },
    });
    expect(result).toEqual({ success: true });
  });

  it('remove throws NotFoundException on P2025', async () => {
    (prismaMock.link.delete as jest.Mock).mockRejectedValue(makeP2025());

    await expect(service.remove('user1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  // --- getRandom ---

  it('getRandom returns null when there are no links', async () => {
    (prismaMock.link.count as jest.Mock).mockResolvedValue(0);

    const result = await service.getRandom('user1');

    expect(result).toBeNull();
    expect(prismaMock.link.findMany).not.toHaveBeenCalled();
  });

  it('getRandom returns a link when links exist', async () => {
    const link = makeLink();
    (prismaMock.link.count as jest.Mock).mockResolvedValue(3);
    (prismaMock.link.findMany as jest.Mock).mockResolvedValue([link]);

    const result = await service.getRandom('user1');

    expect(result).toBe(link);
    expect(prismaMock.link.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
  });
});
