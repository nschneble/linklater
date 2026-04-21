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

const makeLink = (overrides = {}) => ({
  id: 'BFA17BB0-3DB7-4CA9-B422-2FAAE5D888B3',
  userId: '61A00384-3D01-44C6-A360-CD55120A0453',
  url: 'https://jakub.kr/writing/details-that-make-interfaces-feel-better',
  title: 'Details That Make Interfaces Feel Better',
  host: 'jakub.kr',
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
    send: jest.fn().mockResolvedValue('37C4B604-A600-40DE-9E6C-9C5F1F2A4CAF'),
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

  it('parses host from URL on create', async () => {
    (prismaMock.link.create as jest.Mock).mockResolvedValue(
      makeLink({
        id: 'AA25D44F-EA87-4B79-BF04-181B278025A6',
        url: 'https://codecov.io',
        host: 'codecov.io',
      }),
    );

    const link = await service.create('user-1', {
      url: 'https://codecov.io',
      title: 'Codecov',
    });

    expect(prismaMock.link.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ host: 'codecov.io' }),
      }),
    );
    expect(link.host).toBe('codecov.io');
    expect(queueMock.send).toHaveBeenCalledWith(QUEUES.METADATA_FETCH, {
      linkId: 'AA25D44F-EA87-4B79-BF04-181B278025A6',
      url: 'https://codecov.io',
    });
  });

  it('throws on invalid URL', async () => {
    await expect(
      service.create('2788CA79-AAF5-498D-9A1E-32E69BC4C095', {
        url: 'not-even-remotely-a-url',
      }),
    ).rejects.toThrow('Invalid url');
  });

  it('findAll returns paginated results with defaults', async () => {
    (prismaMock.link.findMany as jest.Mock).mockResolvedValue([makeLink()]);
    (prismaMock.link.count as jest.Mock).mockResolvedValue(1);

    const result = await service.findAll(
      '8A8ADC29-E328-40EB-B4C0-6EEF64A1B234',
      {},
    );

    expect(prismaMock.link.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: '8A8ADC29-E328-40EB-B4C0-6EEF64A1B234' },
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

    await service.findAll('DAD72564-B96F-4B87-86EE-40FE7D295875', {
      archived: true,
    });

    expect(prismaMock.link.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ archivedAt: { not: null } }),
      }),
    );
  });

  it('findAll adds OR search conditions when search is provided', async () => {
    (prismaMock.link.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.link.count as jest.Mock).mockResolvedValue(0);

    await service.findAll('C97955FE-C79A-420D-8FA8-2BCE71B3A5E7', {
      search: 'yoo hoo',
    });

    expect(prismaMock.link.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    );
  });

  it('findOne returns link when found', async () => {
    const link = makeLink();
    (prismaMock.link.findFirst as jest.Mock).mockResolvedValue(link);

    const result = await service.findOne(
      'BD73EBCF-8BFF-49D1-9B59-27982CE15800',
      '981B5371-4DED-490D-9E5D-00499DF4E3FB',
    );

    expect(result).toBe(link);
  });

  it('findOne throws NotFoundException when link is not found', async () => {
    (prismaMock.link.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.findOne('0063F2AF-BFA6-4185-A2D6-D8A19CA829FB', 'missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('update returns updated link', async () => {
    const link = makeLink({
      title: 'This Is Very Much Not The Original Title',
    });
    (prismaMock.link.update as jest.Mock).mockResolvedValue(link);

    const result = await service.update(
      'FAB0F351-56A6-49A6-B6C9-B10C9783CF4A',
      'D378D95D-016A-4154-869C-A223CDF04272',
      {
        title: 'This Is Very Much Not The Original Title',
      },
    );

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'D378D95D-016A-4154-869C-A223CDF04272',
          userId: 'FAB0F351-56A6-49A6-B6C9-B10C9783CF4A',
        },
      }),
    );
    expect(result?.title).toBe('This Is Very Much Not The Original Title');
  });

  it('update throws NotFoundException on P2025', async () => {
    (prismaMock.link.update as jest.Mock).mockRejectedValue(makeP2025());

    await expect(
      service.update('AC8305DF-8258-462D-974E-E54DC6B1857C', 'missing', {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('archive sets archivedAt and returns link', async () => {
    const archived = makeLink({ archivedAt: new Date() });
    (prismaMock.link.update as jest.Mock).mockResolvedValue(archived);

    const result = await service.archive(
      'E7963367-2E21-43C1-B2F8-7274E77619BC',
      'EE20939D-FE38-4D1D-9399-A956B70AAF85',
    );

    expect(result?.archivedAt).not.toBeNull();
  });

  it('archive throws NotFoundException on P2025', async () => {
    (prismaMock.link.update as jest.Mock).mockRejectedValue(makeP2025());

    await expect(
      service.archive('7B5C7140-6D51-4257-8287-5B960973A083', 'missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('unarchive clears archivedAt and returns link', async () => {
    const unarchived = makeLink({ archivedAt: null });
    (prismaMock.link.update as jest.Mock).mockResolvedValue(unarchived);

    const result = await service.unarchive(
      'A374F950-3533-4EE5-B118-03DD60B5CC39',
      'AE65F8C4-434D-4AB5-8272-E2B00B654E6A',
    );

    expect(result?.archivedAt).toBeNull();
  });

  it('unarchive throws NotFoundException on P2025', async () => {
    (prismaMock.link.update as jest.Mock).mockRejectedValue(makeP2025());

    await expect(
      service.unarchive('DCB636E4-D843-48C2-9377-015A2FF15B10', 'missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('remove returns { success: true }', async () => {
    (prismaMock.link.delete as jest.Mock).mockResolvedValue(undefined);

    const result = await service.remove(
      'C18C52E1-FB96-4532-8D76-1E44DC5B2BE5',
      '0104D4E8-3555-477E-85B2-5D1B2E503173',
    );

    expect(prismaMock.link.delete).toHaveBeenCalledWith({
      where: {
        id: '0104D4E8-3555-477E-85B2-5D1B2E503173',
        userId: 'C18C52E1-FB96-4532-8D76-1E44DC5B2BE5',
      },
    });
    expect(result).toEqual({ success: true });
  });

  it('remove throws NotFoundException on P2025', async () => {
    (prismaMock.link.delete as jest.Mock).mockRejectedValue(makeP2025());

    await expect(
      service.remove('B6A5D852-8F47-4603-BD5A-BBB173C4351A', 'missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('getRandom returns null when there are no links', async () => {
    (prismaMock.link.count as jest.Mock).mockResolvedValue(0);

    const result = await service.getRandom(
      'D01007C5-92AF-43AD-A397-6257DA607383',
    );

    expect(result).toBeNull();
    expect(prismaMock.link.findMany).not.toHaveBeenCalled();
  });

  it('getRandom returns a link when links exist', async () => {
    const link = makeLink();
    (prismaMock.link.count as jest.Mock).mockResolvedValue(3);
    (prismaMock.link.findMany as jest.Mock).mockResolvedValue([link]);

    const result = await service.getRandom(
      '38E38741-DC4A-4F86-B59A-5193AC9933D4',
    );

    expect(result).toBe(link);
    expect(prismaMock.link.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
  });
});
