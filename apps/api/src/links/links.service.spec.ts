import { Test, TestingModule } from '@nestjs/testing';
import { LinksService } from './links.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LinksService', () => {
  let service: LinksService;

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
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<LinksService>(LinksService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('parses host from URL on create', async () => {
    (prismaMock.link.create as jest.Mock).mockResolvedValue({
      id: '1',
      userId: 'user1',
      url: 'https://example.com/path',
      title: 'Example',
      host: 'example.com',
      notes: null,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const link = await service.create('user1', {
      url: 'https://example.com/path',
      title: 'Example',
    });

    expect(prismaMock.link.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          host: 'example.com',
        }),
      }),
    );
    expect(link.host).toBe('example.com');
  });

  it('throws on invalid URL', async () => {
    await expect(
      service.create('user1', { url: 'not-a-url' }),
    ).rejects.toThrow('Invalid URL');
  });
});
