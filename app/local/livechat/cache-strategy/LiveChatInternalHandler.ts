import { ILivechatRead, IModify } from '@rocket.chat/apps-engine/definition/accessors';
import { ILivechatRoom, IVisitor } from '@rocket.chat/apps-engine/definition/livechat';
import { IMessageAttachment } from '@rocket.chat/apps-engine/definition/messages';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import ILiveChatInternalDataSource from '../../../data/livechat/cache-strategy/ILiveChatInternalDataSource';
import Department from '../../../domain/Department';

export default class LiveChatInternalHandler implements ILiveChatInternalDataSource {

    constructor(
        private readonly modify: IModify,
        private readonly livechatReader: ILivechatRead,
    ) {
    }

    public async closeRoom(room: ILivechatRoom, comment: string): Promise<void> {
        await this.modify.getUpdater().getLivechatUpdater().closeRoom(room, comment);
    }

    public async createRoom(visitor: IVisitor) {
        const room = await this.modify.getCreator().getLivechatCreator().createRoom(visitor, {} as IUser);
        return room;
    }

    public async getDepartmentByName(name: string): Promise<Department | undefined> {
        const department = await this.livechatReader.getLivechatDepartmentByIdOrName(name);
        return department as Department;
    }

    public async sendMessage(text: string, attachments: Array<IMessageAttachment>, room: ILivechatRoom): Promise<void> {
        const livechatMessageBuilder = this.modify.getCreator().startLivechatMessage()
            .setRoom(room)
            .setVisitor(room.visitor);
        if (text) {
            livechatMessageBuilder.setText(text);
        }
        // TODO: else to handle attachments
        await this.modify.getCreator().finish(livechatMessageBuilder);
    }

}
