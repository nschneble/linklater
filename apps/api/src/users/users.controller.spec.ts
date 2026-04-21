import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;

  const usersServiceMock = {
    findById: jest.fn(),
    updateMe: jest.fn(),
    deleteById: jest.fn(),
  } as unknown as UsersService;

  const makeRequest = (userId = '0A758448-0873-4101-8D5D-ED52246B63B5') =>
    ({ user: { userId } }) as never;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersServiceMock }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getMe delegates to UsersService.findById with userId from request', async () => {
    const user = {
      id: '0A758448-0873-4101-8D5D-ED52246B63B5',
      email: 'bene.gesserit@arrakis.order',
    };
    (usersServiceMock.findById as jest.Mock).mockResolvedValue(user);

    const result = await controller.getMe(makeRequest());

    expect(usersServiceMock.findById).toHaveBeenCalledWith(
      '0A758448-0873-4101-8D5D-ED52246B63B5',
    );
    expect(result).toBe(user);
  });

  it('updateMe delegates to UsersService.updateMe with userId from request', async () => {
    const updated = {
      id: 'A87B3CD7-93F9-4CF3-B77A-AE58F326F0E0',
      email: 'trillian.wildspace@hhggverse.org',
    };
    (usersServiceMock.updateMe as jest.Mock).mockResolvedValue(updated);

    const result = await controller.updateMe(makeRequest(), {
      email: 'trillian.wildspace@hhggverse.org',
    } as never);

    expect(usersServiceMock.updateMe).toHaveBeenCalledWith(
      '0A758448-0873-4101-8D5D-ED52246B63B5',
      {
        email: 'trillian.wildspace@hhggverse.org',
      },
    );
    expect(result).toBe(updated);
  });

  it('deleteMe delegates to UsersService.deleteById and returns success', async () => {
    (usersServiceMock.deleteById as jest.Mock).mockResolvedValue(undefined);

    const result = await controller.deleteMe(makeRequest());

    expect(usersServiceMock.deleteById).toHaveBeenCalledWith(
      '0A758448-0873-4101-8D5D-ED52246B63B5',
    );
    expect(result).toEqual({ success: true });
  });
});
