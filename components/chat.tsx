export function Chat() {
    return <div className="h-full flex flex-col items-center justify-start gap-2 w-full md:max-w-2/3 pt-8">
        <UserMessage message="Research task: What is the capital of France?" />
        <AssistantMessage message="I'm here to help you with your research. What would you like to know?" />
        <UserMessage message="Lorem ipsum dolor, sit amet consectetur adipisicing elit. Dolor dignissimos nulla dicta! Molestiae repellat repudiandae nemo ab, dolor esse maxime, tempore similique soluta eligendi voluptatum a rem reprehenderit animi ullam!" />
    </div>
}


function UserMessage({ message }: { message: string }) {
    return <div className="rounded-2xl p-4 bg-zinc-900 mt-4 self-end max-w-2/3">
        {message}
    </div>
}

function AssistantMessage({ message }: { message: string }) {
    return <div className="rounded-2xl p-4 bg-zinc-900 mt-4 self-start max-w-4/5">
        {message}
    </div>
}